import { and, eq, inArray, or, sql } from "drizzle-orm";
import { submissionAuthors, submissions, type Db, type ReferenceSources } from "@cp/db";
import { chunkValues } from "./imports/d1";

/** Which submissions count as a reviewer's own work for a division: their
 *  submissions in the division itself, in the selected other divisions of the
 *  same edition, and in the selected other editions */
export function referenceScope(editionId: number, divisionId: number, sources: ReferenceSources) {
  const divisionIds = [divisionId, ...sources.divisionIds];
  return or(
    and(eq(submissions.editionId, editionId), inArray(submissions.divisionId, divisionIds)),
    sources.editionIds.length > 0 ? inArray(submissions.editionId, sources.editionIds) : undefined,
  )!;
}

/** Number of own submissions per person within the reference scope */
export async function referenceCounts(
  db: Db,
  personIds: number[],
  scope: ReturnType<typeof referenceScope>,
) {
  const counts = new Map<number, number>();
  for (const part of chunkValues(personIds, 80)) {
    const rows = await db
      .select({ personId: submissionAuthors.personId, n: sql<number>`count(distinct ${submissions.id})` })
      .from(submissionAuthors)
      .innerJoin(submissions, eq(submissions.id, submissionAuthors.submissionId))
      .where(and(inArray(submissionAuthors.personId, part), scope))
      .groupBy(submissionAuthors.personId);
    for (const r of rows) counts.set(r.personId, r.n);
  }
  return counts;
}
