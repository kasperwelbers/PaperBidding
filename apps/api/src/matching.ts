// The input for matchReviewers (@cp/shared) for a division in an edition.

import { and, eq, inArray } from "drizzle-orm";
import { conflictReason, type MatchingReviewer } from "@cp/shared";
import { bids, divisionEditions, submissionAuthors, submissions, type Db } from "@cp/db";
import { getEmbedder } from "./embeddings";
import { chunkValues } from "./imports/d1";
import { divisionPool, divisionsOfReviewers } from "./pool";
import { divisionCandidates, ownEmbeddings, rankFor } from "./ranking";
import { referenceScope } from "./references";
import { loadConflictReviewers, loadConflictSubmissions } from "./review-conflicts";

export async function matchingInput(
  env: Env,
  db: Db,
  args: {
    edition: { id: number; conferenceId: number; createdAt: Date };
    divisionId: number;
    divisionEdition: typeof divisionEditions.$inferSelect;
    conflictRules: Parameters<typeof conflictReason>[2];
    embeddingLanguage: "english" | "multilingual";
  },
) {
  const { edition, divisionId, divisionEdition } = args;
  const model = getEmbedder(env, args.embeddingLanguage).model;
  const candidates = await divisionCandidates(db, edition.id, divisionId, model);
  const submissionIds = candidates.map((c) => c.id);

  // willing reviewers in the pool (not taken out)
  const pool = (await divisionPool(db, edition.id, divisionId)).filter((r) => !r.excluded && r.canReview);
  const personIds = pool.map((r) => r.personId);

  const conflictReviewers = await loadConflictReviewers(db, edition, personIds);
  const conflictSubmissions = await loadConflictSubmissions(db, submissionIds);
  const scope = referenceScope(edition.id, divisionId, divisionEdition.referenceSources);
  const own = await ownEmbeddings(db, personIds, scope, model);
  const divisionCounts = await divisionsOfReviewers(db, pool.map((r) => r.reviewerId));
  const bidRows = new Map(
    (await db.select().from(bids).where(eq(bids.divisionEditionId, divisionEdition.id))).map((b) => [
      b.reviewerId,
      b.submissionIds,
    ]),
  );
  const authors = new Set<number>();
  for (const part of chunkValues(personIds, 80))
    for (const a of await db
      .selectDistinct({ personId: submissionAuthors.personId })
      .from(submissionAuthors)
      .innerJoin(submissions, eq(submissions.id, submissionAuthors.submissionId))
      .where(
        and(
          inArray(submissionAuthors.personId, part),
          eq(submissions.editionId, edition.id),
          eq(submissions.divisionId, divisionId),
        ),
      ))
      authors.add(a.personId);

  const reviewers: MatchingReviewer[] = pool.map((r) => {
    const cr = conflictReviewers.get(r.personId)!;
    const allowed = candidates.filter(
      (c) => conflictReason(cr, conflictSubmissions.get(c.id)!, args.conflictRules) === null,
    );
    return {
      id: r.reviewerId,
      student: r.student,
      author: authors.has(r.personId),
      divisions: divisionCounts.get(r.reviewerId)?.size ?? 1,
      bids: bidRows.get(r.reviewerId) ?? [],
      ranked: rankFor(r.reviewerId, allowed, own.get(r.personId) ?? []).map((s) => s.id),
    };
  });
  return { submissionIds, reviewers };
}
