import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { matchKeywordToDivision } from "@cp/adapter-scholarone";
import { divisions, keywords, reviewerKeywords, type Db } from "@cp/db";
import { chunkRows, chunkValues } from "./d1";

/** Ensures the keywords exist, auto-assigns new ones to divisions by name, and
 *  returns text -> keyword id */
export async function upsertKeywords(
  db: Db,
  conferenceId: number,
  texts: string[],
  separator: string,
) {
  const unique = [...new Set(texts)];
  for (const part of chunkRows(unique, 2))
    await db
      .insert(keywords)
      .values(part.map((text) => ({ conferenceId, text })))
      .onConflictDoNothing();
  await autoAssignKeywords(db, conferenceId, separator, unique);

  const ids = new Map<string, number>();
  for (const part of chunkValues(unique)) {
    const rows = await db
      .select({ id: keywords.id, text: keywords.text })
      .from(keywords)
      .where(and(eq(keywords.conferenceId, conferenceId), inArray(keywords.text, part)));
    for (const r of rows) ids.set(r.text, r.id);
  }
  return ids;
}

/** Assigns unassigned keywords (never assigned by hand) to divisions by name.
 *  Without `texts`: all keywords of the conference. Returns the number
 *  assigned */
export async function autoAssignKeywords(
  db: Db,
  conferenceId: number,
  separator: string,
  texts?: string[],
) {
  const divisionRows = await db
    .select({ id: divisions.id, name: divisions.name })
    .from(divisions)
    .where(eq(divisions.conferenceId, conferenceId));
  if (divisionRows.length === 0) return 0;

  const open = and(
    eq(keywords.conferenceId, conferenceId),
    isNull(keywords.divisionId),
    isNull(keywords.assignedBy),
  );
  const candidates = texts
    ? (
        await Promise.all(
          chunkValues(texts).map((part) =>
            db
              .select({ id: keywords.id, text: keywords.text })
              .from(keywords)
              .where(and(open, inArray(keywords.text, part))),
          ),
        )
      ).flat()
    : await db.select({ id: keywords.id, text: keywords.text }).from(keywords).where(open);

  const updates = candidates.flatMap((k) => {
    const division = matchKeywordToDivision(k.text, divisionRows, separator);
    return division
      ? [
          db
            .update(keywords)
            .set({ divisionId: division.id, assignedBy: "auto" })
            .where(eq(keywords.id, k.id)),
        ]
      : [];
  });
  if (updates.length > 0) await db.batch(updates as [any, ...any[]]);
  return updates.length;
}

/** Recomputes the "keyword" division links of the given reviewers from their
 *  keywords */
export async function recomputeKeywordDivisions(db: Db, reviewerIds: number[]) {
  for (const part of chunkValues(reviewerIds)) {
    const ids = sql.join(part.map((id) => sql`${id}`), sql`, `);
    // derived data, so it's fine that these are two statements: recomputing again fixes it
    await db.run(
      sql`delete from reviewer_divisions where source = 'keyword' and reviewer_id in (${ids})`,
    );
    await db.run(sql`
      insert or ignore into reviewer_divisions (reviewer_id, division_id, source)
      select distinct rk.reviewer_id, k.division_id, 'keyword'
      from reviewer_keywords rk join keywords k on k.id = rk.keyword_id
      where k.division_id is not null and rk.reviewer_id in (${ids})`);
  }
}

/** Reviewers that have a keyword (to recompute after reassigning it) */
export async function reviewersWithKeyword(db: Db, keywordId: number) {
  const rows = await db
    .select({ id: reviewerKeywords.reviewerId })
    .from(reviewerKeywords)
    .where(eq(reviewerKeywords.keywordId, keywordId));
  return rows.map((r) => r.id);
}
