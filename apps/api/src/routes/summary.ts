import { and, eq, isNull, sql } from "drizzle-orm";
import { divisionReviewerExclusions, divisions, reviewerDivisions, reviewers, submissions } from "@cp/db";
import { router } from "../context";

/** Counts per division for an edition, and how many divisions reviewers are in */
export const summaryRoutes = router().get("/", async (c) => {
  const db = c.get("db");
  const editionId = c.get("editionId");

  const divisionRows = await db
    .select({ id: divisions.id, name: divisions.name })
    .from(divisions)
    .where(eq(divisions.conferenceId, c.get("conferenceId")))
    .orderBy(divisions.name);
  const submissionCounts = await db
    .select({ divisionId: submissions.divisionId, n: sql<number>`count(*)` })
    .from(submissions)
    .where(eq(submissions.editionId, editionId))
    .groupBy(submissions.divisionId);
  const reviewerCounts = await db
    .select({
      divisionId: reviewerDivisions.divisionId,
      n: sql<number>`count(distinct ${reviewerDivisions.reviewerId})`,
    })
    .from(reviewerDivisions)
    .innerJoin(reviewers, eq(reviewers.id, reviewerDivisions.reviewerId))
    .leftJoin(
      divisionReviewerExclusions,
      and(
        eq(divisionReviewerExclusions.reviewerId, reviewerDivisions.reviewerId),
        eq(divisionReviewerExclusions.divisionId, reviewerDivisions.divisionId),
      ),
    )
    .where(and(eq(reviewers.editionId, editionId), isNull(divisionReviewerExclusions.reviewerId)))
    .groupBy(reviewerDivisions.divisionId);

  // number of divisions per reviewer -> number of reviewers
  const load = await db.all<{ divisions: number; reviewers: number }>(sql`
    select divisions, count(*) as reviewers from (
      select r.id, count(distinct rd.division_id) as divisions
      from reviewers r
      left join reviewer_divisions rd on rd.reviewer_id = r.id
        and not exists (select 1 from division_reviewer_exclusions x
                        where x.reviewer_id = rd.reviewer_id and x.division_id = rd.division_id)
      where r.edition_id = ${editionId}
      group by r.id
    ) group by divisions order by divisions`);

  const [totals] = await db
    .select({ submissions: sql<number>`count(*)` })
    .from(submissions)
    .where(eq(submissions.editionId, editionId));
  const [noDivision] = await db
    .select({ n: sql<number>`count(*)` })
    .from(submissions)
    .where(and(eq(submissions.editionId, editionId), isNull(submissions.divisionId)));

  return c.json({
    submissions: totals?.submissions ?? 0,
    submissionsWithoutDivision: noDivision?.n ?? 0,
    reviewers: load.reduce((sum, l) => sum + l.reviewers, 0),
    /** e.g. [{ divisions: 0, reviewers: 12 }, { divisions: 1, reviewers: 300 }, ...] */
    divisionLoad: load,
    divisions: divisionRows.map((d) => ({
      ...d,
      submissions: submissionCounts.find((s) => s.divisionId === d.id)?.n ?? 0,
      reviewers: reviewerCounts.find((r) => r.divisionId === d.id)?.n ?? 0,
    })),
  });
});
