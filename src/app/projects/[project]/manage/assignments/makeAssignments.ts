import { rankedSubmissions } from "@/lib/computeRelevantSubmissions";
import {
  GetReviewer,
  GetMetaSubmission,
  Bidding,
  RankedReviewer,
  ByReviewer,
  BySubmission,
} from "@/types";

export default function makeAssignments(
  reviewers: GetReviewer[],
  submissions: GetMetaSubmission[],
) {
  const reviewersPerSubmission = 3; // TODO: make this a parameter
  // for automatically added biddings, add penalty so matching is favoured
  // for reviewers that bidded manually
  const autoPenalty = 5; // TODO: make this a parameter

  const biddingMap = new Map<number, Bidding[]>();
  const reviewerCount = new Map<string, number>();
  const forbiddenAssignments = getForbiddingAssignments(reviewers, submissions);

  // copy so we don't mutate the original
  submissions = submissions.map((submission) => ({ ...submission }));
  reviewers = reviewers.map((reviewer) => ({
    ...reviewer,
    biddings: [...reviewer.biddings],
  }));

  // for biddings not made, add rank based on similarity
  reviewers = fillMissingBiddings(reviewers, submissions, forbiddenAssignments);

  for (const reviewer of reviewers) {
    let i = 0;
    reviewerCount.set(reviewer.email, 0);
    for (const internalId of reviewer.biddings) {
      if (!biddingMap.has(internalId)) biddingMap.set(internalId, []);

      const biddingsArray = biddingMap.get(internalId);

      biddingsArray?.push({
        reviewer: reviewer.email,
        method: i >= reviewer.manualBiddings ? "auto" : "manual",
        rank: autoPenalty + i++,
      });
    }
  }

  // We'll first assign the most suitable reviewers, regardless of
  // how many submissions they've already been assigned to. Later
  // we'll balance out the assignments over all reviewers.
  for (const submission of submissions) {
    // biddings is total set of biddings
    let biddings = biddingMap.get(submission.id);
    if (!biddings) {
      submission.reviewers = [];
      continue;
    }
    submission.biddings = biddings;

    // compute selected [initialReviewersPerSubmission] reviewers

    // remove reviewers that have already been assigned maxPerReviewer submissions
    // biddings = biddings.filter(
    //   (b) => (reviewerCount.get(b.reviewer) || 0) < maxPerReviewer,
    // );

    // remove reviewers that are forbidden to review this submission
    biddings = biddings.filter(
      (b) => !forbiddenAssignments[b.reviewer]?.includes(submission.id),
    );

    // then sort by rank and reviewerCount (i.e. how often reviewer has already been assigned)
    biddings.sort((a: Bidding, b: Bidding) => {
      return a.rank - b.rank;
      // const aCount = reviewerCount.get(a.reviewer) || 0;
      // const bCount = reviewerCount.get(b.reviewer) || 0;
      // const combinedRankA = a.rank + aCount * 2;
      // const combinedRankB = b.rank + bCount * 2;
      // return combinedRankA - combinedRankB;
    });

    // assign bests matches
    submission.reviewers = biddings
      .slice(0, reviewersPerSubmission)
      .map((b) => ({ email: b.reviewer, rank: b.rank, method: b.method }));
    submission.reviewers.forEach((reviewer) => {
      reviewerCount.set(
        reviewer.email,
        (reviewerCount.get(reviewer.email) || 0) + 1,
      );
    });

    // assign backup reviewers (for balancing out later on)
    submission.backupReviewers = biddings
      .slice(reviewersPerSubmission)
      .map((b) => ({ email: b.reviewer, rank: b.rank, method: b.method }));
  }

  submissions = fillRemaining(
    submissions,
    reviewerCount,
    reviewersPerSubmission,
    forbiddenAssignments,
  );

  submissions = balanceSubmissionsPerReviewer(submissions, reviewerCount);

  const bySubmission: BySubmission[] = submissions.map((submission) => {
    const data: BySubmission = {
      submission_id: submission.submissionId,
      title: submission.title,
      authors: submission.authors.join(", "),
    };
    for (let i = 0; i < submission.reviewers.length; i++) {
      const reviewerKey = `reviewer_${i + 1}`;
      const rankKey = `reviewer.rank_${i + 1}`;
      const { email, method, rank } = submission.reviewers[i];
      data[reviewerKey] = email;
      data[rankKey] = method === "auto" ? `auto (${rank})` : `bid (${rank})`;
    }
    //data.biddings = JSON.stringify(data.biddings);
    return data;
  });

  const data: Record<string, ByReviewer> = {};
  let maxSubmissions = 0;
  for (const submission of submissions) {
    for (const reviewer of submission.reviewers) {
      const { email, method, rank } = reviewer;
      if (!data[email]) data[email] = { reviewer: email };
      const nSubmissions = Object.keys(data[email]).length - 1;
      maxSubmissions = Math.max(maxSubmissions, nSubmissions);
      data[email]["submission_" + (nSubmissions + 1)] = submission.submissionId;
      data[email]["submission.rank_" + (nSubmissions + 1)] =
        method === "auto" ? `auto (${rank})` : `bid (${rank})`;
    }
  }
  const byReviewer: ByReviewer[] = Object.values(data).map((row) => {
    for (let i = Object.keys(row).length - 1; i <= maxSubmissions; i++) {
      if (!row["submission_" + (i + 1)]) row["submission_" + (i + 1)] = "";
    }
    return row;
  });
  return { byReviewer, bySubmission };
}

function balanceSubmissionsPerReviewer(
  submissions: GetMetaSubmission[],
  reviewerCount: Map<string, number>,
) {
  // balance out the number of submissions per reviewer.
  // If a reviewer has relatively many submissions,
  // replace with a backupReviewer with relatively few submissions.

  return submissions.map((s) => {
    s.reviewers = s.reviewers.map((reviewer, ri) => {
      const rCount = reviewerCount.get(reviewer.email) || 0;
      // if (rCount !== maxCount) return reviewer;

      for (let bi = 0; bi < s.backupReviewers.length; bi++) {
        const backup = s.backupReviewers[bi];
        const bCount = reviewerCount.get(backup.email) || 0;
        // if (bCount !== minCount) continue;
        if (rCount - bCount < 2) continue;

        reviewerCount.set(reviewer.email, rCount - 1);
        reviewerCount.set(backup.email, bCount + 1);
        s.backupReviewers[bi] = reviewer;
        return backup;
      }
      return reviewer;
    });
    return s;
  });
}

function fillRemaining(
  submissions: GetMetaSubmission[],
  reviewerCount: Map<string, number>,
  reviewersPerSubmission: number,
  forbiddenAssignments: Record<string, number[]>,
) {
  // if any submissions have less than the minimum reviewers, we need to fill them up randomly.
  // This should only happen very rarely, if ranks are extremely clustered
  const remaining = Array.from(reviewerCount)
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => a.count - b.count)
    .map((a) => a.email);

  for (const submission of submissions) {
    for (let i = 0; i < reviewersPerSubmission; i++) {
      if (!submission.reviewers[i]) {
        console.log("fill remaining");
        submission.reviewers[i] = pickNext(
          remaining,
          submission,
          forbiddenAssignments,
        );
      }
    }
  }

  return submissions;
}

function pickNext(
  remaining: string[],
  submission: GetMetaSubmission,
  forbiddenAssignments: Record<string, number[]>,
): RankedReviewer {
  for (let i = 0; i < remaining.length; i++) {
    if (forbiddenAssignments[remaining[i]]?.includes(submission.id)) continue;
    if (submission.reviewers.some((r) => r.email === remaining[i])) continue;

    const pick = remaining[i];
    remaining.splice(i, 1);
    remaining.push(pick);
    return { email: pick, method: "auto", rank: 999 };
  }
  return { email: "", method: "auto", rank: 999 };
}

function getForbiddingAssignments(
  reviewers: GetReviewer[],
  submissions: GetMetaSubmission[],
) {
  // ensure no-one is assigned to own submission, or submission by a co-author
  // (also excluding submissions by co-authors that they are not on themselves)
  const forbiddenAssignments: Record<string, number[]> = {};

  for (let submission of submissions) {
    for (let reviewer of reviewers) {
      let forbidden = false;
      if (submission.authors.includes(reviewer.email)) forbidden = true;
      for (let coAuthor of reviewer.coAuthors) {
        if (submission.authors.includes(coAuthor)) {
          forbidden = true;
          break;
        }
      }
      if (forbidden) {
        if (!forbiddenAssignments[reviewer.email])
          forbiddenAssignments[reviewer.email] = [];
        forbiddenAssignments[reviewer.email].push(submission.id);
      }
    }
  }

  return forbiddenAssignments;
}

function fillMissingBiddings(
  reviewers: GetReviewer[],
  submissions: GetMetaSubmission[],
  forbiddenAssignments: Record<string, number[]>,
) {
  const maxBiddings = 200;
  for (let reviewer of reviewers) {
    if (reviewer.biddings.length > maxBiddings) continue;

    const allowedSubmissions = submissions.filter((submission) => {
      const forbiddenSubmissions = forbiddenAssignments[reviewer.email] || [];
      return !forbiddenSubmissions.includes(submission.id);
    });

    const ranked = rankedSubmissions(allowedSubmissions, reviewer.submissions);
    let ranked_i = 0;

    for (let bidding_i = 0; bidding_i < maxBiddings; bidding_i++) {
      if (reviewer.biddings[bidding_i]) continue;
      if (ranked_i >= ranked.length) break;

      if (reviewer.biddings.includes(ranked[ranked_i].id)) {
        bidding_i--;
        ranked_i++;
        continue;
      }

      reviewer.biddings[bidding_i] = ranked[ranked_i].id;
    }
  }

  return reviewers;
}
