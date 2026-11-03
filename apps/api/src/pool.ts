// A division's reviewer pool in an edition: reviewers linked to the division
// (by keyword, by a planner, or via the join link), minus those a planner
// excluded. Used by the division page, the summary, bidding and matching.

import { and, eq, inArray, sql } from "drizzle-orm";
import {
  divisionReviewerExclusions,
  reviewerDivisions,
  reviewers,
  type Db,
} from "@cp/db";
import { chunkValues } from "./imports/d1";

export interface PoolReviewer {
  reviewerId: number;
  personId: number;
  student: boolean;
  canReview: boolean;
  /** how they are linked: keyword, planner, join_link */
  sources: string[];
  excluded: boolean;
}

/** Everyone linked to the division, with `excluded` set for those taken out */
export async function divisionPool(db: Db, editionId: number, divisionId: number): Promise<PoolReviewer[]> {
  const rows = await db
    .select({
      reviewerId: reviewers.id,
      personId: reviewers.personId,
      student: reviewers.student,
      canReview: reviewers.canReview,
      sources: sql<string>`group_concat(distinct ${reviewerDivisions.source})`,
      excluded: sql<number>`max(${divisionReviewerExclusions.reviewerId} is not null)`,
    })
    .from(reviewers)
    .innerJoin(
      reviewerDivisions,
      and(eq(reviewerDivisions.reviewerId, reviewers.id), eq(reviewerDivisions.divisionId, divisionId)),
    )
    .leftJoin(
      divisionReviewerExclusions,
      and(
        eq(divisionReviewerExclusions.reviewerId, reviewers.id),
        eq(divisionReviewerExclusions.divisionId, divisionId),
      ),
    )
    .where(eq(reviewers.editionId, editionId))
    .groupBy(reviewers.id);
  return rows.map((r) => ({
    ...r,
    sources: (r.sources ?? "").split(",").filter(Boolean),
    excluded: r.excluded === 1,
  }));
}

/** For each reviewer: the divisions they are in (not excluded from) */
export async function divisionsOfReviewers(db: Db, reviewerIds: number[]) {
  const result = new Map<number, Set<number>>();
  for (const part of chunkValues(reviewerIds)) {
    const rows = await db
      .selectDistinct({ reviewerId: reviewerDivisions.reviewerId, divisionId: reviewerDivisions.divisionId })
      .from(reviewerDivisions)
      .leftJoin(
        divisionReviewerExclusions,
        and(
          eq(divisionReviewerExclusions.reviewerId, reviewerDivisions.reviewerId),
          eq(divisionReviewerExclusions.divisionId, reviewerDivisions.divisionId),
        ),
      )
      .where(and(inArray(reviewerDivisions.reviewerId, part), sql`${divisionReviewerExclusions.reviewerId} is null`));
    for (const r of rows) {
      const set = result.get(r.reviewerId) ?? new Set();
      set.add(r.divisionId);
      result.set(r.reviewerId, set);
    }
  }
  return result;
}

/** Adds a person to an edition's reviewers (if needed), and links them to a
 *  division. Removes an exclusion, since adding someone is explicit */
export async function addToPool(
  db: Db,
  args: {
    editionId: number;
    divisionId: number;
    personId: number;
    source: "planner" | "join_link";
    secret: string;
    student?: boolean;
  },
) {
  await db
    .insert(reviewers)
    .values({
      editionId: args.editionId,
      personId: args.personId,
      source: args.source,
      student: args.student ?? false,
      secret: args.secret,
    })
    .onConflictDoNothing();
  const reviewer = (await db.query.reviewers.findFirst({
    where: and(eq(reviewers.editionId, args.editionId), eq(reviewers.personId, args.personId)),
  }))!;
  if (args.student !== undefined && args.source === "join_link" && reviewer.source === "join_link")
    await db.update(reviewers).set({ student: args.student }).where(eq(reviewers.id, reviewer.id));
  await db
    .insert(reviewerDivisions)
    .values({ reviewerId: reviewer.id, divisionId: args.divisionId, source: args.source })
    .onConflictDoNothing();
  await db
    .delete(divisionReviewerExclusions)
    .where(
      and(
        eq(divisionReviewerExclusions.reviewerId, reviewer.id),
        eq(divisionReviewerExclusions.divisionId, args.divisionId),
      ),
    );
  return reviewer;
}
