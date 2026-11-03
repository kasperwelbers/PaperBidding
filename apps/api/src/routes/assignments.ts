import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { defaultMatchingSettings, matchReviewers, replaceReviewer, type MatchingResult } from "@cp/shared";
import { assignments, conferences, divisionEditions, editions, personIdentifiers, reviewers, submissions } from "@cp/db";
import { createMiddleware } from "hono/factory";
import type { Context } from "hono";
import { router, type AppEnv } from "../context";
import { chunkValues } from "../imports/d1";
import { matchingInput } from "../matching";
import { exportStatus, setPersonId } from "../export";
import { scholarOneAdapter } from "@cp/adapter-scholarone";

const settingsSchema = z.object({
  reviewersPerSubmission: z.number().int().min(1).max(10),
  maxStudentReviewers: z.number().int().min(0).max(10),
  noBidPenalty: z.number().min(0).max(100),
  includeWho: z.enum(["all", "authors", "authors or bidders"]),
  divisionShare: z.boolean(),
});

const requireEditor = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("canEditDivision"))
    return c.json({ error: "Only the division's planners and conference admins can do this" }, 403);
  await next();
});

async function load(c: Context<AppEnv>) {
  return c.get("db").query.assignments.findFirst({
    where: eq(assignments.divisionEditionId, c.get("divisionEditionId")),
  });
}

async function save(c: Context<AppEnv>, result: MatchingResult) {
  await c
    .get("db")
    .update(assignments)
    .set({ result: result.assignments, backups: result.backups })
    .where(eq(assignments.divisionEditionId, c.get("divisionEditionId")));
}

/** Reviewer assignments of a division in an edition */
export const assignmentRoutes = router()
  .get("/", async (c) => {
    const db = c.get("db");
    const de = (await db.query.divisionEditions.findFirst({
      where: eq(divisionEditions.id, c.get("divisionEditionId")),
    }))!;
    const row = await load(c);
    const settings = row?.settings ?? de.matchingSettings ?? defaultMatchingSettings;
    if (!row) return c.json({ settings, computedAt: null, exportedAt: null, submissions: [], reviewers: [], skipped: 0 });

    const submissionIds = Object.keys(row.result).map(Number);
    const reviewerIds = [...new Set(Object.values(row.result).flatMap((l) => l.map((a) => a.reviewerId)))];
    const subs = new Map<number, { externalId: string; title: string }>();
    for (const part of chunkValues(submissionIds))
      for (const s of await db
        .select({ id: submissions.id, externalId: submissions.externalId, title: submissions.title })
        .from(submissions)
        .where(inArray(submissions.id, part)))
        subs.set(s.id, s);
    const emails = new Map<number, string>();
    for (const part of chunkValues(reviewerIds, 80))
      for (const r of await db
        .select({ id: reviewers.id, email: personIdentifiers.value, pid: personIdentifiers.id })
        .from(reviewers)
        .innerJoin(personIdentifiers, eq(personIdentifiers.personId, reviewers.personId))
        .where(and(inArray(reviewers.id, part), eq(personIdentifiers.kind, "email")))
        .orderBy(personIdentifiers.id))
        if (!emails.has(r.id)) emails.set(r.id, r.email);

    const load_ = new Map<number, { count: number; student: boolean }>();
    for (const list of Object.values(row.result))
      for (const a of list) {
        const l = load_.get(a.reviewerId) ?? { count: 0, student: a.student };
        l.count++;
        load_.set(a.reviewerId, l);
      }
    return c.json({
      settings: row.settings,
      computedAt: row.computedAt,
      exportedAt: row.exportedAt,
      submissions: submissionIds
        .map((id) => ({
          id,
          externalId: subs.get(id)?.externalId ?? "?",
          title: subs.get(id)?.title ?? "?",
          reviewers: row.result[id]!.map((a) => ({ ...a, email: emails.get(a.reviewerId) ?? null })),
          backups: row.backups[id]?.length ?? 0,
        }))
        .sort((a, b) => a.externalId.localeCompare(b.externalId, undefined, { numeric: true })),
      reviewers: [...load_]
        .map(([reviewerId, l]) => ({ reviewerId, email: emails.get(reviewerId) ?? null, ...l }))
        .sort((a, b) => b.count - a.count),
    });
  })
  /** Compute the assignments (not after they were exported: then only
   *  replacements, unless they are unlocked) */
  .post("/", requireEditor, zValidator("json", z.object({ settings: settingsSchema })), async (c) => {
    const db = c.get("db");
    const existing = await load(c);
    if (existing?.exportedAt)
      return c.json({ error: "These assignments were exported. Unlock them first, or replace reviewers" }, 409);
    const settings = c.req.valid("json").settings;
    const de = (await db.query.divisionEditions.findFirst({ where: eq(divisionEditions.id, c.get("divisionEditionId")) }))!;
    const edition = (await db.query.editions.findFirst({ where: eq(editions.id, c.get("editionId")) }))!;
    const conference = (await db.query.conferences.findFirst({ where: eq(conferences.id, c.get("conferenceId")) }))!;

    const input = await matchingInput(c.env, db, {
      edition,
      divisionId: c.get("divisionId"),
      divisionEdition: de,
      conflictRules: conference.conflictRules,
      embeddingLanguage: conference.embeddingLanguage,
    });
    const result = matchReviewers(input.submissionIds, input.reviewers, settings);
    const values = { settings, result: result.assignments, backups: result.backups, computedAt: new Date() };
    await db
      .insert(assignments)
      .values({ divisionEditionId: de.id, ...values })
      .onConflictDoUpdate({ target: assignments.divisionEditionId, set: values });
    await db.update(divisionEditions).set({ matchingSettings: settings }).where(eq(divisionEditions.id, de.id));
    const short = Object.values(result.assignments).filter((l) => l.length < settings.reviewersPerSubmission).length;
    return c.json({ submissions: input.submissionIds.length, reviewers: input.reviewers.length, short, skipped: result.skipped.length });
  })
  /** Replace a reviewer on one submission, or (without submissionId) on all
   *  their submissions, with the best backups. Nothing else changes */
  .post(
    "/replace",
    requireEditor,
    zValidator("json", z.object({ reviewerId: z.number().int(), submissionId: z.number().int().optional() })),
    async (c) => {
      const row = await load(c);
      if (!row) return c.json({ error: "No assignments yet" }, 404);
      const { reviewerId, submissionId } = c.req.valid("json");
      const result: MatchingResult = { assignments: row.result, backups: row.backups, skipped: [] };
      const studentIds = new Map<number, { student: boolean }>();
      for (const part of chunkValues([...new Set(Object.values(row.backups).flat().concat(reviewerId))], 90))
        for (const r of await c
          .get("db")
          .select({ id: reviewers.id, student: reviewers.student })
          .from(reviewers)
          .where(inArray(reviewers.id, part)))
          studentIds.set(r.id, r);

      const targets = submissionId
        ? [submissionId]
        : Object.entries(row.result)
            .filter(([, l]) => l.some((a) => a.reviewerId === reviewerId))
            .map(([id]) => Number(id));
      const replaced: { submissionId: number; by: number | null }[] = [];
      for (const id of targets)
        replaced.push({
          submissionId: id,
          by: replaceReviewer(result, id, reviewerId, studentIds, row.settings, new Set([reviewerId])),
        });
      await save(c, result);
      return c.json({ replaced });
    },
  )
  /** Mark as exported/final: recomputing is no longer possible */
  .post("/lock", requireEditor, async (c) => {
    await c
      .get("db")
      .update(assignments)
      .set({ exportedAt: new Date() })
      .where(eq(assignments.divisionEditionId, c.get("divisionEditionId")));
    return c.json({ locked: true });
  })
  .post("/unlock", requireEditor, async (c) => {
    await c
      .get("db")
      .update(assignments)
      .set({ exportedAt: null })
      .where(eq(assignments.divisionEditionId, c.get("divisionEditionId")));
    return c.json({ locked: false });
  })
  /** Which assigned reviewers have a person ID, and what to do about the rest */
  .get("/export", async (c) => {
    const row = await load(c);
    if (!row) return c.json({ error: "No assignments yet" }, 404);
    const conference = (await c.get("db").query.conferences.findFirst({ where: eq(conferences.id, c.get("conferenceId")) }))!;
    const settings = scholarOneAdapter.resolveSettings(conference.settings);
    const { rows, ...status } = await exportStatus(c.get("db"), row.result);
    return c.json({
      ...status,
      rows: rows.length,
      exportedAt: row.exportedAt,
      platformName: scholarOneAdapter.name,
      instructions: scholarOneAdapter.exports.assignments.instructions(settings),
    });
  })
  /** The file for the platform's bulk upload. Locks the assignments */
  .post("/export", requireEditor, async (c) => {
    const row = await load(c);
    if (!row) return c.json({ error: "No assignments yet" }, 404);
    const conference = (await c.get("db").query.conferences.findFirst({ where: eq(conferences.id, c.get("conferenceId")) }))!;
    const settings = scholarOneAdapter.resolveSettings(conference.settings);
    const spec = scholarOneAdapter.exports.assignments;
    const status = await exportStatus(c.get("db"), row.result);
    const csv = spec
      .rows({ assignments: status.rows }, settings)
      .map((cells) => cells.map((v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)).join(","))
      .join("\n");
    await c
      .get("db")
      .update(assignments)
      .set({ exportedAt: new Date() })
      .where(eq(assignments.divisionEditionId, c.get("divisionEditionId")));
    return c.body((spec.bom ? "\ufeff" : "") + csv + "\n", 200, {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${spec.filename(settings)}"`,
      "X-Unmatched-Reviewers": String(status.unmatched.length),
    });
  })
  /** Enter a reviewer's person ID by hand (e.g. found by name in the platform) */
  .post(
    "/person-id",
    requireEditor,
    zValidator("json", z.object({ reviewerId: z.number().int(), personId: z.string().trim().min(1).max(64) })),
    async (c) => {
      const { reviewerId, personId } = c.req.valid("json");
      const res = await setPersonId(c.get("db"), { conferenceId: c.get("conferenceId"), reviewerId, platformId: personId });
      if (!res) return c.json({ error: "Not found" }, 404);
      return c.json(res);
    },
  );
