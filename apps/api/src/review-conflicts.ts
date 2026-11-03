// Data for conflictReason (@cp/shared): who may review whom. Used by the
// bidding page and by the matching. Only uses data of the conference itself.

import { and, eq, inArray, lt, ne } from "drizzle-orm";
import { aliasedTable } from "drizzle-orm";
import type { ConflictReviewer, ConflictSubmission } from "@cp/shared";
import { editions, persons, submissionAuthors, submissions, type Db } from "@cp/db";
import { chunkValues } from "./imports/d1";

/** Conflict data for reviewers (by person id) in an edition */
export async function loadConflictReviewers(
  db: Db,
  edition: { id: number; conferenceId: number; createdAt: Date },
  personIds: number[],
): Promise<Map<number, ConflictReviewer>> {
  const previous = (
    await db
      .select({ id: editions.id })
      .from(editions)
      .where(and(eq(editions.conferenceId, edition.conferenceId), lt(editions.createdAt, edition.createdAt)))
  ).map((e) => e.id);

  const result = new Map<number, ConflictReviewer>();
  const coAuthor = aliasedTable(submissionAuthors, "co_author");

  for (const part of chunkValues([...new Set(personIds)], 80)) {
    const people = await db
      .select({ id: persons.id, institution: persons.institution })
      .from(persons)
      .where(inArray(persons.id, part));
    for (const p of people)
      result.set(p.id, {
        personId: p.id,
        institution: p.institution,
        coAuthorsCurrentEdition: new Set(),
        coAuthorsPreviousEditions: new Set(),
      });

    const pairs = await db
      .select({
        personId: submissionAuthors.personId,
        coAuthorId: coAuthor.personId,
        editionId: submissions.editionId,
      })
      .from(submissionAuthors)
      .innerJoin(coAuthor, and(eq(coAuthor.submissionId, submissionAuthors.submissionId), ne(coAuthor.personId, submissionAuthors.personId)))
      .innerJoin(submissions, eq(submissions.id, submissionAuthors.submissionId))
      .where(
        and(
          inArray(submissionAuthors.personId, part),
          inArray(submissions.editionId, [edition.id, ...previous]),
        ),
      );
    for (const pair of pairs) {
      const r = result.get(pair.personId);
      if (!r) continue;
      if (pair.editionId === edition.id) (r.coAuthorsCurrentEdition as Set<number>).add(pair.coAuthorId);
      else (r.coAuthorsPreviousEditions as Set<number>).add(pair.coAuthorId);
    }
  }
  return result;
}

/** Conflict data (authors and their institutions on the submission) */
export async function loadConflictSubmissions(
  db: Db,
  submissionIds: number[],
): Promise<Map<number, ConflictSubmission>> {
  const result = new Map<number, ConflictSubmission>();
  for (const part of chunkValues([...new Set(submissionIds)])) {
    const rows = await db
      .select({
        submissionId: submissionAuthors.submissionId,
        personId: submissionAuthors.personId,
        institution: submissionAuthors.institution,
      })
      .from(submissionAuthors)
      .where(inArray(submissionAuthors.submissionId, part));
    for (const r of rows) {
      const s = result.get(r.submissionId) ?? { authors: [] };
      s.authors.push({ personId: r.personId, institution: r.institution });
      result.set(r.submissionId, s);
    }
  }
  for (const id of submissionIds) if (!result.has(id)) result.set(id, { authors: [] });
  return result;
}
