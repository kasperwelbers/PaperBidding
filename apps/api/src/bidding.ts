// Paper bidding: who is bidding, and the ranked list of submissions they can
// bid on (the division's submissions, minus conflicts, most similar first).

import { and, eq, sql } from "drizzle-orm";
import { conflictReason } from "@cp/shared";
import { divisionCandidates, ownEmbeddings, rankFor } from "./ranking";
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

/** The submissions a reviewer may bid on, most similar to their own work first */
export async function biddingList(env: Env, db: Db, bidder: Bidder) {
  const { edition, division, reviewer } = bidder;
  const model = getEmbedder(env).model;
  const candidates = await divisionCandidates(db, edition.id, division.id, model);

  // conflicts (own, co-authors, institution) are left out
  const conflictReviewer = (await loadConflictReviewers(db, edition, [reviewer.personId])).get(reviewer.personId)!;
  const conflictData = await loadConflictSubmissions(db, candidates.map((s) => s.id));
  const allowed = candidates.filter(
    (s) => conflictReason(conflictReviewer, conflictData.get(s.id)!, bidder.conference.conflictRules) === null,
  );

  // the reviewer's own work: their submissions in the reference sources
  const scope = referenceScope(edition.id, division.id, bidder.divisionEdition.referenceSources);
  const own = (await ownEmbeddings(db, [reviewer.personId], scope, model)).get(reviewer.personId) ?? [];
  return { basedOnOwnWork: own.length > 0, submissions: rankFor(reviewer.id, allowed, own) };
}

export async function currentBids(db: Db, divisionEditionId: number, reviewerId: number) {
  const row = await db.query.bids.findFirst({
    where: and(eq(bids.divisionEditionId, divisionEditionId), eq(bids.reviewerId, reviewerId)),
  });
  return row?.submissionIds ?? [];
}
