// Paper bidding: who is bidding, and the ranked list of submissions they can
// bid on (the division's submissions, minus conflicts, most similar first).

import { and, eq, isNotNull, sql } from "drizzle-orm";
import { blobToEmbedding, conflictReason, rankBySimilarity } from "@cp/shared";
import {
  bids,
  conferences,
  divisionEditions,
  divisionReviewerExclusions,
  divisions,
  editions,
  personIdentifiers,
  reviewerDivisions,
  reviewers,
  submissionAuthors,
  submissions,
  type Db,
} from "@cp/db";
import { getEmbedder } from "./embeddings";
import { referenceScope } from "./references";
import { loadConflictReviewers, loadConflictSubmissions } from "./review-conflicts";

export interface Bidder {
  reviewer: typeof reviewers.$inferSelect;
  divisionEdition: typeof divisionEditions.$inferSelect;
  division: typeof divisions.$inferSelect;
  edition: typeof editions.$inferSelect;
  conference: typeof conferences.$inferSelect;
  email: string | null;
}

/** The reviewer, from a personal link token ("<reviewerId>.<secret>") or from
 *  the signed in user's email. They must be in the division's pool */
export async function resolveBidder(
  db: Db,
  divisionEditionId: number,
  auth: { token?: string | null; email?: string | null },
): Promise<Bidder | null> {
  const de = await db.query.divisionEditions.findFirst({ where: eq(divisionEditions.id, divisionEditionId) });
  if (!de) return null;
  const division = (await db.query.divisions.findFirst({ where: eq(divisions.id, de.divisionId) }))!;
  const edition = (await db.query.editions.findFirst({ where: eq(editions.id, de.editionId) }))!;
  const conference = (await db.query.conferences.findFirst({ where: eq(conferences.id, division.conferenceId) }))!;

  let reviewer: typeof reviewers.$inferSelect | undefined;
  if (auth.token) {
    const [id, secret] = auth.token.split(".");
    const r = await db.query.reviewers.findFirst({ where: eq(reviewers.id, Number(id)) });
    if (r && secret && r.secret === secret && r.editionId === edition.id) reviewer = r;
  } else if (auth.email) {
    const [row] = await db
      .select({ reviewer: reviewers })
      .from(personIdentifiers)
      .innerJoin(reviewers, eq(reviewers.personId, personIdentifiers.personId))
      .where(
        and(
          eq(personIdentifiers.conferenceId, conference.id),
          eq(personIdentifiers.kind, "email"),
          eq(personIdentifiers.value, auth.email),
          eq(reviewers.editionId, edition.id),
        ),
      )
      .limit(1);
    reviewer = row?.reviewer;
  }
  if (!reviewer) return null;

  // in the division's pool, and not taken out
  const [link] = await db
    .select({ id: reviewerDivisions.reviewerId })
    .from(reviewerDivisions)
    .leftJoin(
      divisionReviewerExclusions,
      and(
        eq(divisionReviewerExclusions.reviewerId, reviewerDivisions.reviewerId),
        eq(divisionReviewerExclusions.divisionId, reviewerDivisions.divisionId),
      ),
    )
    .where(
      and(
        eq(reviewerDivisions.reviewerId, reviewer.id),
        eq(reviewerDivisions.divisionId, division.id),
        sql`${divisionReviewerExclusions.reviewerId} is null`,
      ),
    )
    .limit(1);
  if (!link) return null;

  const [email] = await db
    .select({ value: personIdentifiers.value })
    .from(personIdentifiers)
    .where(and(eq(personIdentifiers.personId, reviewer.personId), eq(personIdentifiers.kind, "email")))
    .orderBy(personIdentifiers.id)
    .limit(1);
  return { reviewer, divisionEdition: de, division, edition, conference, email: email?.value ?? null };
}

export function biddingOpen(de: { biddingDeadline: Date | null }, now = new Date()) {
  return !!de.biddingDeadline && now < de.biddingDeadline;
}

/** A stable pseudo-random order, so reviewers without own submissions don't
 *  all see (and bid on) the same submissions first */
function stableOrder(reviewerId: number, submissionId: number) {
  let h = Math.imul(reviewerId ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(submissionId, 0xc2b2ae35);
  h ^= h >>> 13;
  return (Math.imul(h, 0x27d4eb2d) >>> 0) / 4294967296;
}

/** The submissions a reviewer may bid on, most similar to their own work first */
export async function biddingList(env: Env, db: Db, bidder: Bidder) {
  const { edition, division, reviewer } = bidder;
  const model = getEmbedder(env).model;

  const candidates = await db
    .select({ id: submissions.id, title: submissions.title, embedding: submissions.embedding, model: submissions.embeddingModel })
    .from(submissions)
    .where(and(eq(submissions.editionId, edition.id), eq(submissions.divisionId, division.id)));

  // conflicts (own, co-authors, institution) are left out
  const conflictReviewer = (await loadConflictReviewers(db, edition, [reviewer.personId])).get(reviewer.personId)!;
  const conflictData = await loadConflictSubmissions(db, candidates.map((s) => s.id));
  const allowed = candidates.filter(
    (s) => conflictReason(conflictReviewer, conflictData.get(s.id)!, bidder.conference.conflictRules) === null,
  );

  // the reviewer's own work: their submissions in the reference sources
  const own = await db
    .select({ embedding: submissions.embedding })
    .from(submissionAuthors)
    .innerJoin(submissions, eq(submissions.id, submissionAuthors.submissionId))
    .where(
      and(
        eq(submissionAuthors.personId, reviewer.personId),
        referenceScope(edition.id, division.id, bidder.divisionEdition.referenceSources),
        eq(submissions.embeddingModel, model),
        isNotNull(submissions.embedding),
      ),
    );
  const ownEmbeddings = own.map((o) => blobToEmbedding(o.embedding as Uint8Array));

  const withEmbedding = allowed.filter((s) => s.embedding && s.model === model);
  const without = allowed.filter((s) => !(s.embedding && s.model === model));
  const ranked =
    ownEmbeddings.length > 0
      ? rankBySimilarity(
          withEmbedding.map((s) => ({ id: s.id, title: s.title, embedding: blobToEmbedding(s.embedding as Uint8Array) })),
          ownEmbeddings,
        ).map((s) => ({ id: s.id, title: s.title, similarity: s.similarity as number | null }))
      : withEmbedding
          .map((s) => ({ id: s.id, title: s.title, similarity: null as number | null }))
          .sort((a, b) => stableOrder(reviewer.id, a.id) - stableOrder(reviewer.id, b.id));
  return {
    basedOnOwnWork: ownEmbeddings.length > 0,
    submissions: [
      ...ranked,
      ...without.map((s) => ({ id: s.id, title: s.title, similarity: null as number | null })),
    ],
  };
}

export async function currentBids(db: Db, divisionEditionId: number, reviewerId: number) {
  const row = await db.query.bids.findFirst({
    where: and(eq(bids.divisionEditionId, divisionEditionId), eq(bids.reviewerId, reviewerId)),
  });
  return row?.submissionIds ?? [];
}
