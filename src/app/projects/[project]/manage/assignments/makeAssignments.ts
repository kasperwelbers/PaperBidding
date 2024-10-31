import { rankedSubmissions } from "@/lib/computeRelevantSubmissions";
import {
  GetReviewer,
  GetMetaSubmission,
  Bidding,
  RankedReviewer,
  ByReviewer,
  BySubmission,
} from "@/types";

type ReviewerAssignments = Map<string, { submission: number; pRank: number }[]>;

export default function makeAssignments(
  reviewers: GetReviewer[],
  submissions: GetMetaSubmission[],
  reviewersPerSubmission: number,
  autoPenalty: number,
) {
  const biddingMap = new Map<number, Bidding[]>();
  const forbiddenAssignments = getForbiddingAssignments(reviewers, submissions);

  // keep track of submissions per reviewer, ordered by rank
  // use later to balance assignments
  const reviewerAssignments: ReviewerAssignments = new Map();

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
    reviewerAssignments.set(reviewer.email, []);
    for (const internalId of reviewer.biddings) {
      if (!biddingMap.has(internalId)) biddingMap.set(internalId, []);

      const method = i >= reviewer.manualBiddings ? "auto" : "manual";

      const biddingsArray = biddingMap.get(internalId);
      biddingsArray?.push({
        reviewer: reviewer.email,
        method,
        rank: 1 + i++,
        pRank: method === "manual" ? i : i + autoPenalty,
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

    // remove reviewers that are forbidden to review this submission
    biddings = biddings.filter(
      (b) => !forbiddenAssignments[b.reviewer]?.includes(submission.id),
    );

    biddings.sort((a: Bidding, b: Bidding) => {
      return a.pRank - b.pRank;
    });

    // assign bests matches
    submission.reviewers = biddings
      .slice(0, reviewersPerSubmission)
      .map((b) => ({
        email: b.reviewer,
        rank: b.rank,
        method: b.method,
        pRank: b.pRank,
      }));

    submission.reviewers.forEach((reviewer) => {
      reviewerAssignments.get(reviewer.email)?.push({
        submission: submission.id,
        pRank: reviewer.pRank,
      });
    });

    // assign backup reviewers (for balancing out later on)
    submission.backupReviewers = biddings
      .slice(reviewersPerSubmission)
      .map((b) => ({
        email: b.reviewer,
        rank: b.rank,
        method: b.method,
        pRank: b.pRank,
      }));
  }

  submissions = fillRemaining(
    submissions,
    reviewerAssignments,
    reviewersPerSubmission,
    forbiddenAssignments,
  );

  submissions = balanceSubmissionsPerReviewer(
    submissions,
    reviewerAssignments,
    reviewersPerSubmission,
  );

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
      data[rankKey] =
        method === "auto" ? `${rank} + ${autoPenalty}` : `${rank}`;
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
        method === "auto" ? `${rank} + ${autoPenalty}` : `${rank}`;
    }
  }
  const byReviewer: ByReviewer[] = Object.values(data).map((row) => {
    for (let i = Object.keys(row).length - 1; i <= maxSubmissions; i++) {
      if (!row["submission_" + (i + 1)]) row["submission_" + (i + 1)] = "";
    }
    return row;
  });
  return {
    byReviewer,
    bySubmission,
    settings: { reviewersPerSubmission, autoPenalty },
  };
}

function balanceSubmissionsPerReviewer(
  submissions: GetMetaSubmission[],
  reviewerAssignments: ReviewerAssignments,
  reviewersPerSubmission: number,
) {
  // balance out the number of submissions per reviewer.
  // If a reviewer has relatively many submissions,
  // replace with a backupReviewer with relatively few submissions.

  // calculate how many submissions each reviewer should have
  const total = submissions.length;
  const reviewers = reviewerAssignments.size;
  const maxCount = Math.floor((total * reviewersPerSubmission) / reviewers);

  const reassignMap: Map<number, string[]> = new Map();
  for (let [reviewer, assignments] of reviewerAssignments) {
    const toMany = assignments.length - maxCount;
    if (toMany <= 0) continue;

    // determine which reviewers need to be reassigned, starting with their lowest matches
    const sIds = assignments
      .sort((a, b) => {
        return b.pRank - a.pRank;
      })
      .map((s) => s.submission);

    for (let i = 0; i < toMany; i++) {
      const sId = sIds[i];

      if (!reassignMap.get(sId)) reassignMap.set(sId, []);
      reassignMap.get(sId)?.push(reviewer);
    }
  }

  return submissions.map((s) => {
    const reassign = reassignMap.get(s.id) || [];
    if (reassign.length === 0) return s;

    s.reviewers = s.reviewers.map((reviewer, ri) => {
      if (!reassign.includes(reviewer.email)) return reviewer;
      for (let backup of s.backupReviewers) {
        const count = reviewerAssignments.get(backup.email)?.length || 0;
        if (count >= maxCount) continue;
        reviewerAssignments
          .get(backup.email)
          ?.push({ submission: s.id, pRank: backup.pRank });
        return backup;
      }
      return reviewer;
    });
    return s;
  });
}

function fillRemaining(
  submissions: GetMetaSubmission[],
  reviewerAssignments: ReviewerAssignments,
  reviewersPerSubmission: number,
  forbiddenAssignments: Record<string, number[]>,
) {
  // if any submissions have less than the minimum reviewers, we need to fill them up randomly.
  // This should only happen very rarely, if ranks are extremely clustered
  const remaining = Array.from(reviewerAssignments)
    .map(([email, assigments]) => ({ email, count: assigments.length }))
    .sort((a, b) => a.count - b.count)
    .map((a) => a.email);

  for (const submission of submissions) {
    for (let i = 0; i < reviewersPerSubmission; i++) {
      if (!submission.reviewers[i]) {
        const add = pickNext(remaining, submission, forbiddenAssignments);
        submission.reviewers[i] = add;
        reviewerAssignments.get(add.email)?.push({
          submission: submission.id,
          pRank: add.pRank,
        });
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
    return { email: pick, method: "auto", rank: 999, pRank: 999 };
  }
  return { email: "", method: "auto", rank: 999, pRank: 999 };
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
      if (submission.authors.includes(reviewer.email)) {
        forbidden = true;
      } else {
        if (submission.institutions.includes(reviewer.institution)) {
          forbidden = true;
          console.log(
            "forbidden: institution",
            submission.submissionId,
            reviewer.email,
          );
        }
        for (let coAuthor of reviewer.coAuthors) {
          if (submission.authors.includes(coAuthor)) {
            forbidden = true;
            console.log(
              "forbidden: co-author",
              submission.submissionId,
              reviewer.email,
            );
            break;
          }
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

function penalizedRank(reviewer: RankedReviewer, autoPenalty: number) {
  return reviewer.method === "auto"
    ? reviewer.rank + autoPenalty
    : reviewer.rank;
}
