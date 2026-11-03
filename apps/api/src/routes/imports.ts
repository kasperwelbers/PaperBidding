import { zValidator } from "@hono/zod-validator";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { detectColumns, missingFields, parseCsvHeaders } from "@cp/shared";
import { scholarOneAdapter } from "@cp/adapter-scholarone";
import { conferences, importJobs } from "@cp/db";
import { divisions } from "@cp/db";
import type { Context } from "hono";
import { router, userEmail, type AppEnv } from "../context";
import { enqueue, jobFolder } from "../imports/process";
import { canEditConference, canEditDivision } from "../permissions";

/** Conference admins import everything. Planners can import a reviewer list
 *  for a division they work on (the reviewers are linked to that division),
 *  and the persons matching list */
async function canImport(c: Context<AppEnv>, kind: string, divisionId: number | null | undefined) {
  if (canEditConference(c.get("role"))) return true;
  // the matching list (emails and person IDs) only adds missing IDs; an email
  // that belongs to someone else becomes a conflict, never an overwrite
  if (kind === "persons" && !divisionId) return c.get("role") === "planner";
  if (kind !== "reviewers" || !divisionId) return false;
  const division = await c.get("db").query.divisions.findFirst({
    where: and(eq(divisions.id, divisionId), eq(divisions.conferenceId, c.get("conferenceId"))),
  });
  return !!division && (await canEditDivision(c.env, c.get("db"), userEmail(c), divisionId));
}

const kinds = ["submissions", "persons", "reviewers"] as const;
const MAX_SIZE = 95 * 1024 * 1024; // Workers accept request bodies up to 100 MB

async function settingsOf(c: { get(k: "db"): any }, conferenceId: number) {
  const conference = await c.get("db").query.conferences.findFirst({
    where: eq(conferences.id, conferenceId),
  });
  return scholarOneAdapter.resolveSettings(conference?.settings);
}

/** Import jobs of an edition. Conference admins import the central data */
export const importRoutes = router()
  /** What each import needs: instructions and fields (from the adapter) */
  .get("/specs", async (c) => {
    const settings = await settingsOf(c, c.get("conferenceId"));
    return c.json(
      kinds.map((kind) => {
        const spec = scholarOneAdapter.imports[kind];
        return {
          kind,
          label: spec.label,
          instructions: spec.instructions(settings),
          fields: spec.fields(settings),
        };
      }),
    );
  })
  .get("/", async (c) => {
    const rows = await c
      .get("db")
      .select()
      .from(importJobs)
      .where(eq(importJobs.editionId, c.get("editionId")))
      .orderBy(desc(importJobs.createdAt));
    return c.json(rows);
  })
  /** Upload a file (the raw request body). Stores it in R2 and proposes a
   *  column mapping from the header row */
  .post(
    "/",
    zValidator(
      "query",
      z.object({
        kind: z.enum(kinds),
        filename: z.string().min(1).max(200),
        divisionId: z.coerce.number().int().positive().optional(),
      }),
    ),
    async (c) => {
      const { kind, filename, divisionId } = c.req.valid("query");
      if (!(await canImport(c, kind, divisionId)))
        return c.json({ error: "You cannot import this" }, 403);
      const size = Number(c.req.header("content-length") ?? 0);
      if (!c.req.raw.body || size === 0) return c.json({ error: "The file is empty" }, 400);
      if (size > MAX_SIZE) return c.json({ error: "The file is too large (max 95 MB)" }, 400);

      const db = c.get("db");
      const conferenceId = c.get("conferenceId");
      const editionId = c.get("editionId");
      const [job] = await db
        .insert(importJobs)
        .values({
          editionId,
          kind,
          divisionId: divisionId ?? null,
          status: "uploaded",
          filename,
          fileKey: "",
          size,
          createdBy: userEmail(c),
        })
        .returning();
      const fileKey = `${jobFolder(conferenceId, editionId, job!.id)}/source.csv`;
      await c.env.FILES.put(fileKey, c.req.raw.body, {
        httpMetadata: { contentType: "text/csv" },
      });

      const head = await c.env.FILES.get(fileKey, { range: { offset: 0, length: 64 * 1024 } });
      const headers = parseCsvHeaders((await head?.text()) ?? "");
      const settings = await settingsOf(c, conferenceId);
      const spec = scholarOneAdapter.imports[kind];
      const mapping = detectColumns(headers, spec.fields(settings));
      const [updated] = await db
        .update(importJobs)
        .set({ fileKey, mapping })
        .where(eq(importJobs.id, job!.id))
        .returning();
      return c.json({ job: updated!, headers }, 201);
    },
  )
  /** Start (or restart) an import with the chosen column mapping */
  .post(
    "/:jobId/start",
    zValidator("json", z.object({ mapping: z.record(z.string(), z.string()) })),
    async (c) => {
      const db = c.get("db");
      const jobId = Number(c.req.param("jobId"));
      const job = await db.query.importJobs.findFirst({
        where: and(eq(importJobs.id, jobId), eq(importJobs.editionId, c.get("editionId"))),
      });
      if (!job) return c.json({ error: "Not found" }, 404);
      if (!(await canImport(c, job.kind, job.divisionId)))
        return c.json({ error: "You cannot import this" }, 403);
      if (!["uploaded", "failed", "done"].includes(job.status))
        return c.json({ error: "This import is already running" }, 409);

      const mapping = Object.fromEntries(
        Object.entries(c.req.valid("json").mapping).filter(([, header]) => header),
      );
      const settings = await settingsOf(c, c.get("conferenceId"));
      const spec = scholarOneAdapter.imports[job.kind];
      const missing = missingFields(mapping, spec.fields(settings));
      if (missing.length > 0)
        return c.json({ error: `Select a column for: ${missing.map((f) => f.label).join(", ")}` }, 400);
      const problems = spec.checkMapping?.(mapping, settings) ?? [];
      if (problems.length > 0) return c.json({ error: problems.join(". ") }, 400);

      await db
        .update(importJobs)
        .set({ mapping, status: "queued", error: null, updatedAt: new Date() })
        .where(eq(importJobs.id, jobId));
      await enqueue(c.env, { jobId, step: "parse" });
      return c.json({ id: jobId, status: "queued" as const });
    },
  )
  .get("/:jobId", async (c) => {
    const job = await c.get("db").query.importJobs.findFirst({
      where: and(
        eq(importJobs.id, Number(c.req.param("jobId"))),
        eq(importJobs.editionId, c.get("editionId")),
      ),
    });
    if (!job) return c.json({ error: "Not found" }, 404);
    return c.json(job);
  });
