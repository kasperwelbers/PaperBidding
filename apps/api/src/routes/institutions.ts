import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { institutionResolver, normalizeInstitution, searchUniversities } from "@cp/institutions";
import { editions, institutionAliases, persons, submissionAuthors, submissions } from "@cp/db";
import { router } from "../context";
import { requireUser } from "../middleware";
import { requireConferenceAdmin } from "./shared";

/** Search the bundled university list (for picking an institution by hand) */
export const institutionSearchRoutes = router()
  .use(requireUser)
  .get("/search", zValidator("query", z.object({ q: z.string().max(200) })), (c) =>
    c.json(searchUniversities(c.req.valid("query").q)),
  );

/** Institution names in a conference's data that are not in the university
 *  list, and aliases that map them to an institution */
export const conferenceInstitutionRoutes = router()
  .get("/unresolved", async (c) => {
    const db = c.get("db");
    const conferenceId = c.get("conferenceId");
    const editionIds = (
      await db.select({ id: editions.id }).from(editions).where(eq(editions.conferenceId, conferenceId))
    ).map((e) => e.id);

    const counts = new Map<string, number>();
    const add = (rows: { name: string | null; n: number }[]) => {
      for (const r of rows) if (r.name) counts.set(r.name, (counts.get(r.name) ?? 0) + r.n);
    };
    if (editionIds.length > 0)
      add(
        await db
          .select({ name: submissionAuthors.institution, n: sql<number>`count(*)` })
          .from(submissionAuthors)
          .innerJoin(submissions, eq(submissions.id, submissionAuthors.submissionId))
          .where(and(inArray(submissions.editionId, editionIds), isNotNull(submissionAuthors.institution)))
          .groupBy(submissionAuthors.institution),
      );
    add(
      await db
        .select({ name: persons.institution, n: sql<number>`count(*)` })
        .from(persons)
        .where(and(eq(persons.conferenceId, conferenceId), isNotNull(persons.institution)))
        .groupBy(persons.institution),
    );

    const aliasTargets = new Set(
      (
        await db
          .select({ institution: institutionAliases.institution })
          .from(institutionAliases)
          .where(eq(institutionAliases.conferenceId, conferenceId))
      ).map((a) => a.institution),
    );
    const resolver = institutionResolver();
    const unresolved = [...counts]
      .filter(([name]) => !resolver.isKnown(name) && !aliasTargets.has(name))
      .map(([name, n]) => ({ name, count: n }))
      .sort((a, b) => b.count - a.count);
    return c.json(unresolved);
  })
  .get("/aliases", async (c) => {
    const rows = await c
      .get("db")
      .select()
      .from(institutionAliases)
      .where(eq(institutionAliases.conferenceId, c.get("conferenceId")))
      .orderBy(institutionAliases.raw);
    return c.json(rows);
  })
  /** Map an institution name as it appears in the data to an institution (the
   *  same name = it's an institution of its own). Applies to existing data
   *  right away, and to later imports */
  .put(
    "/aliases",
    requireConferenceAdmin,
    zValidator(
      "json",
      z.object({ text: z.string().trim().min(1), institution: z.string().trim().min(1) }),
    ),
    async (c) => {
      const db = c.get("db");
      const conferenceId = c.get("conferenceId");
      const { text, institution } = c.req.valid("json");
      const raw = normalizeInstitution(text);
      await db
        .insert(institutionAliases)
        .values({ conferenceId, raw, institution })
        .onConflictDoUpdate({
          target: [institutionAliases.conferenceId, institutionAliases.raw],
          set: { institution },
        });

      const editionIds = (
        await db.select({ id: editions.id }).from(editions).where(eq(editions.conferenceId, conferenceId))
      ).map((e) => e.id);
      if (editionIds.length > 0)
        await db
          .update(submissionAuthors)
          .set({ institution })
          .where(
            and(
              eq(submissionAuthors.institution, text),
              inArray(
                submissionAuthors.submissionId,
                db.select({ id: submissions.id }).from(submissions).where(inArray(submissions.editionId, editionIds)),
              ),
            ),
          );
      await db
        .update(persons)
        .set({ institution })
        .where(and(eq(persons.conferenceId, conferenceId), eq(persons.institution, text)));
      return c.json({ raw, institution });
    },
  )
  .delete("/aliases/:raw", requireConferenceAdmin, async (c) => {
    await c
      .get("db")
      .delete(institutionAliases)
      .where(
        and(
          eq(institutionAliases.conferenceId, c.get("conferenceId")),
          eq(institutionAliases.raw, c.req.param("raw")),
        ),
      );
    return c.json({ raw: c.req.param("raw") });
  });
