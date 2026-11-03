import { zValidator } from "@hono/zod-validator";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { scholarOneAdapter } from "@cp/adapter-scholarone";
import { conferences, divisions, importConflicts, keywords, personIdentifiers, reviewerKeywords } from "@cp/db";
import { router } from "../context";
import {
  autoAssignKeywords,
  recomputeKeywordDivisions,
  reviewersWithKeyword,
} from "../imports/keywords";
import { requireConferenceAdmin } from "./shared";

/** Expertise keywords and their divisions (conference level) */
export const keywordRoutes = router()
  .get("/", async (c) => {
    const rows = await c
      .get("db")
      .select({
        id: keywords.id,
        text: keywords.text,
        divisionId: keywords.divisionId,
        assignedBy: keywords.assignedBy,
        reviewers: sql<number>`count(${reviewerKeywords.reviewerId})`,
      })
      .from(keywords)
      .leftJoin(reviewerKeywords, eq(reviewerKeywords.keywordId, keywords.id))
      .where(eq(keywords.conferenceId, c.get("conferenceId")))
      .groupBy(keywords.id)
      .orderBy(keywords.text);
    return c.json(rows);
  })
  /** Assign a keyword by hand (null = no division). Kept on later imports */
  .patch(
    "/:keywordId",
    requireConferenceAdmin,
    zValidator("json", z.object({ divisionId: z.number().int().nullable() })),
    async (c) => {
      const db = c.get("db");
      const conferenceId = c.get("conferenceId");
      const keywordId = Number(c.req.param("keywordId"));
      const { divisionId } = c.req.valid("json");
      if (divisionId !== null) {
        const division = await db.query.divisions.findFirst({
          where: and(eq(divisions.id, divisionId), eq(divisions.conferenceId, conferenceId)),
        });
        if (!division) return c.json({ error: "Unknown division" }, 400);
      }
      const [row] = await db
        .update(keywords)
        .set({ divisionId, assignedBy: "manual" })
        .where(and(eq(keywords.id, keywordId), eq(keywords.conferenceId, conferenceId)))
        .returning();
      if (!row) return c.json({ error: "Not found" }, 404);
      await recomputeKeywordDivisions(db, await reviewersWithKeyword(db, keywordId));
      return c.json(row);
    },
  )
  /** Match unassigned keywords to divisions by name again (e.g. after adding
   *  divisions) */
  .post("/auto-assign", requireConferenceAdmin, async (c) => {
    const db = c.get("db");
    const conferenceId = c.get("conferenceId");
    const conference = await db.query.conferences.findFirst({ where: eq(conferences.id, conferenceId) });
    const settings = scholarOneAdapter.resolveSettings(conference?.settings);
    const assigned = await autoAssignKeywords(db, conferenceId, settings.reviewers.keywordSeparator);
    const affected = await db
      .selectDistinct({ id: reviewerKeywords.reviewerId })
      .from(reviewerKeywords)
      .innerJoin(keywords, eq(keywords.id, reviewerKeywords.keywordId))
      .where(eq(keywords.conferenceId, conferenceId));
    await recomputeKeywordDivisions(db, affected.map((r) => r.id));
    return c.json({ assigned });
  });

/** Identifiers that imports could not apply (conference level) */
export const importConflictRoutes = router()
  .get("/", async (c) => {
    const db = c.get("db");
    const rows = await db
      .select()
      .from(importConflicts)
      .where(and(eq(importConflicts.conferenceId, c.get("conferenceId")), isNull(importConflicts.resolvedAt)))
      .orderBy(importConflicts.value);
    const personIds = [...new Set(rows.flatMap((r) => [r.existingPersonId, r.incomingPersonId]))];
    const identifiers =
      personIds.length === 0
        ? []
        : await db
            .select()
            .from(personIdentifiers)
            .where(sql`${personIdentifiers.personId} in (${sql.join(personIds.map((id) => sql`${id}`), sql`, `)})`);
    const describe = (personId: number) =>
      identifiers.filter((i) => i.personId === personId).map((i) => ({ kind: i.kind, value: i.value }));
    return c.json(
      rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        value: r.value,
        existing: { personId: r.existingPersonId, identifiers: describe(r.existingPersonId) },
        incoming: { personId: r.incomingPersonId, identifiers: describe(r.incomingPersonId) },
        createdAt: r.createdAt,
      })),
    );
  })
  /** keep: the identifier stays where it is. move: it goes to the incoming person */
  .post(
    "/:conflictId/resolve",
    requireConferenceAdmin,
    zValidator("json", z.object({ action: z.enum(["keep", "move"]) })),
    async (c) => {
      const db = c.get("db");
      const conferenceId = c.get("conferenceId");
      const conflict = await db.query.importConflicts.findFirst({
        where: and(
          eq(importConflicts.id, Number(c.req.param("conflictId"))),
          eq(importConflicts.conferenceId, conferenceId),
        ),
      });
      if (!conflict) return c.json({ error: "Not found" }, 404);
      if (c.req.valid("json").action === "move")
        await db
          .update(personIdentifiers)
          .set({ personId: conflict.incomingPersonId })
          .where(
            and(
              eq(personIdentifiers.conferenceId, conferenceId),
              eq(personIdentifiers.kind, conflict.kind),
              eq(personIdentifiers.value, conflict.value),
            ),
          );
      await db
        .update(importConflicts)
        .set({ resolvedAt: new Date() })
        .where(eq(importConflicts.id, conflict.id));
      return c.json({ id: conflict.id });
    },
  );
