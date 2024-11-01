import { rankedSubmissions } from "@/lib/computeRelevantSubmissions";
import {
  GetReviewer,
  GetMetaSubmission,
  Bidding,
  ByReviewer,
  BySubmission,
  SubmissionWithReviewers,
} from "@/types";
import hash from "object-hash";

type ReviewerAssignments = Map<string, { submission: number; pRank: number }[]>;

export default function makeAssignments(
  reviewers: GetReviewer[],
  submissionData: GetMetaSubmission[],
  reviewersPerSubmission: number,
  maxStudentReviewers: number,
  autoPenalty: number,
) {
  const biddingMap = new Map<number, Bidding[]>();
  const forbiddenAssignments = getForbiddingAssignments(
    reviewers,
    submissionData,
  );

  // keep track of submissions per reviewer, ordered by rank. use later to balance assignments
  const reviewerAssignments: ReviewerAssignments = new Map();

  // copy so we don't mutate the original
  // submissionData = submissions.map((submission) => ({ ...submission }));
  reviewers = reviewers.map((reviewer) => ({
    ...reviewer,
    biddings: [...reviewer.biddings],
  }));

  // for biddings not made, add rank based on similarity
  reviewers = fillMissingBiddings(
    reviewers,
    submissionData,
    forbiddenAssignments,
  );

  for (const reviewer of reviewers) {
    let i = 0;
    const nrHash = hashToNumber(reviewer.email);
    reviewerAssignments.set(reviewer.email, []);
    for (const internalId of reviewer.biddings) {
      if (!biddingMap.has(internalId)) biddingMap.set(internalId, []);

      const method = i >= reviewer.manualBiddings ? "auto" : "manual";

      const biddingsArray = biddingMap.get(internalId);
      biddingsArray?.push({
        email: reviewer.email,
        method,
        rank: 1 + i++,
        pRank: method === "manual" ? i : i + autoPenalty,
        student: reviewer.student,
        order: (nrHash + internalId * 77777) % 1000,
        submissionRank: 0,
      });
    }
  }

  // prepare submissions for assigning reviewers based on biddings
  let submissions: SubmissionWithReviewers[] = submissionData
    .map((s) => {
      const submission: SubmissionWithReviewers = {
        ...s,
        biddings: [],
        reviewers: [],
        backupReviewers: [],
        studentReviewerCount: 0,
        ready: false,
        balanced: false,
        order: hashToNumber(s.submissionId), // start random ish
      };

      let biddings = biddingMap.get(submission.id);

      if (biddings) {
        submission.biddings = biddings
          .filter(
            (b) => !forbiddenAssignments[b.email]?.includes(submission.id),
          )
          .sort((a: Bidding, b: Bidding) => {
            return a.order - b.order;
          })
          .sort((a: Bidding, b: Bidding) => {
            return a.pRank - b.pRank;
          })
          .map((b, i) => {
            return { ...b, submissionRank: i + 1 };
          });
      }
      return submission;
    })
    .sort((a, b) => {
      return a.order - b.order;
    });

  // We'll first assign the most suitable reviewers, regardless of
  // how many submissions they've already been assigned to. Later
  // we'll balance out the assignments over all reviewers.
  // Note that we assign one reviewer per submission at a time, to avoid
  // that the best matches are assigned to the first submissions.
  let allAssigned = false;
  while (!allAssigned) {
    for (let submission of submissions) {
      if (submission.ready) continue;

      if (submission.reviewers.length >= reviewersPerSubmission) {
        // if we have enough reviewers, we're done with this submission,
        // and we'll assign all leftover reviewers as backup reviewers
        submission.ready = true;
        submission.backupReviewers = [
          ...submission.backupReviewers,
          ...submission.biddings,
        ];
        continue;
      }

      const candidate = submission.biddings.shift();
      if (!candidate) {
        submission.ready = true;
        continue;
      }

      const studentReviewers = submission.studentReviewerCount || 0;
      if (candidate.student && studentReviewers >= maxStudentReviewers) {
        submission.backupReviewers.push(candidate);
        continue;
      }

      submission.reviewers.push(candidate);

      reviewerAssignments.get(candidate.email)?.push({
        submission: submission.id,
        pRank: candidate.pRank,
      });
      if (candidate.student) submission.studentReviewerCount++;
    }

    allAssigned = submissions.every((s) => s.ready);
  }

  submissions = fillRemaining(
    submissions,
    reviewerAssignments,
    reviewersPerSubmission,
    forbiddenAssignments,
  );

  submissions = balanceSubmissionsPerReviewer(
    submissions,
    reviewers,
    reviewerAssignments,
    reviewersPerSubmission,
    maxStudentReviewers,
    reviewers.filter((r) => r.student).length,
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
      const studentKey = `reviewer.student_${i + 1}`;
      const { email, method, rank, submissionRank, student } =
        submission.reviewers[i];
      data[reviewerKey] = email;
      data[rankKey] = method === "auto" ? `${rank}*` : `${rank}`;
      data[studentKey] = student ? "yes" : "no";
    }
    //data.biddings = JSON.stringify(data.biddings);
    return data;
  });

  const data: Record<string, ByReviewer> = {};
  let maxSubmissions = 0;
  for (const submission of submissions) {
    for (const reviewer of submission.reviewers) {
      const { email: email, method, rank } = reviewer;
      if (!data[email])
        data[email] = {
          reviewer: email,
          student: reviewer.student ? "Yes" : "No",
        };
      const nSubmissions = Object.keys(data[email]).length - 2;
      maxSubmissions = Math.max(maxSubmissions, nSubmissions);
      data[email]["submission_" + (nSubmissions + 1)] = submission.submissionId;
    }
  }
  for (const r of reviewers) {
    if (!data[r.email])
      data[r.email] = { reviewer: r.email, student: r.student ? "Yes" : "No" };
  }

  const byReviewer: ByReviewer[] = Object.values(data).map((row) => {
    // for (let i = Object.keys(row).length - 1; i <= maxSubmissions; i++) {
    //   if (!row["submission_" + (i + 1)]) row["submission_" + (i + 1)] = "";
    // }
    return row;
  });
  return {
    byReviewer,
    bySubmission,
    settings: { reviewersPerSubmission, autoPenalty, maxStudentReviewers },
  };
}

function balanceSubmissionsPerReviewer(
  submissions: SubmissionWithReviewers[],
  reviewers: GetReviewer[],
  reviewerAssignments: ReviewerAssignments,
  reviewersPerSubmission: number,
  maxStudentReviewers: number,
  studentReviewers: number,
) {
  // balance out the number of submissions per reviewer.
  // If a reviewer has relatively many submissions,
  // replace with a backupReviewer with relatively few submissions.

  // calculate how many submissions each reviewer should have
  const total = submissions.length;
  const Nreviewers = reviewerAssignments.size;
  const maxCount = Math.ceil((total * reviewersPerSubmission) / Nreviewers);
  const maxStudentCount = Math.ceil(
    (total * Math.min(maxStudentReviewers, reviewersPerSubmission)) /
      studentReviewers,
  );

  const reassignMapUnordered: Map<
    number,
    { reviewer: string; rank: number; toMany: number }[]
  > = new Map();
  const toManyMap: Map<string, number> = new Map();
  for (let [reviewer, assignments] of reviewerAssignments) {
    const student =
      reviewers.find((r) => r.email === reviewer)?.student || false;
    const toMany = assignments.length - (student ? maxStudentCount : maxCount);

    if (toMany <= 0) continue;

    toManyMap.set(reviewer, toMany);

    for (let a of assignments) {
      const sId = a.submission;
      if (!reassignMapUnordered.get(sId)) reassignMapUnordered.set(sId, []);
      reassignMapUnordered.get(sId)?.push({
        reviewer,
        rank: a.pRank,
        toMany,
      });
    }
  }

  // sort reassignMap so that we first reassign the weakest matches, and reviewers with the most overassignments
  const reassignMap: Map<number, string[]> = new Map();
  for (let [sId, reassigns] of reassignMapUnordered) {
    reassignMap.set(
      sId,
      reassigns
        .sort((a, b) => {
          return b.rank - a.rank || b.toMany - a.toMany;
        })
        .map((r) => r.reviewer),
    );
  }

  let allBalanced = false;
  // one submission at a time, we'll reassign the reviewer with the most overassignment, or
  // the one with the weakest match
  while (!allBalanced) {
    for (let s of submissions) {
      if (s.balanced) continue;
      const reassign = reassignMap.get(s.id) || [];
      if (reassign.length === 0) {
        s.balanced = true;
        continue;
      }

      const reassignReviewer = reassign.shift();
      if (reassignReviewer === undefined) continue;

      const toMany = toManyMap.get(reassignReviewer) || 0;
      if (toMany <= 0) continue;

      const currentReviewers = s.reviewers.map((r) => r.email);
      const reassignI = s.reviewers.findIndex(
        (r) => r.email === reassignReviewer,
      );
      const currentReviewer = s.reviewers[reassignI];
      if (reassignI < 0) continue;

      // sort backup to prioritize replacements that have a good match and few assignments
      s.backupReviewers = s.backupReviewers
        .map((br) => {
          return {
            ...br,
            assignments: reviewerAssignments.get(br.email)?.length || 0,
          };
        })
        .sort((a, b) => {
          return a.assignments - b.assignments || a.pRank - b.pRank;
          // return a.pRank - b.pRank || a.assignments - b.assignments;
        });

      for (let backup of s.backupReviewers) {
        if (backup.student) {
          // only add student if it replaces a student or if there are less than maxStudentReviewers
          if (
            !currentReviewer.student &&
            s.studentReviewerCount >= maxStudentReviewers
          )
            continue;
        }

        const count = reviewerAssignments.get(backup.email)?.length || 0;
        const mc = backup.student ? maxStudentCount : maxCount;
        if (toMany === 1 && count >= mc) continue;
        if (toMany === 2 && count >= mc + 1) continue;
        if (toMany === 3 && count >= mc + 2) continue;

        if (currentReviewers.includes(backup.email)) {
          continue;
        }

        s.reviewers[reassignI] = backup;
        toManyMap.set(reassignReviewer, toMany - 1);
        reviewerAssignments.get(backup.email)?.push({
          submission: s.id,
          pRank: backup.pRank,
        });

        if (currentReviewer.student) s.studentReviewerCount--;
        if (backup.student) s.studentReviewerCount++;

        break;
      }
    }
    allBalanced = submissions.every((s) => s.balanced);
  }

  return submissions;
}

function fillRemaining(
  submissions: SubmissionWithReviewers[],
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
  submission: SubmissionWithReviewers,
  forbiddenAssignments: Record<string, number[]>,
): Bidding {
  for (let i = 0; i < remaining.length; i++) {
    if (forbiddenAssignments[remaining[i]]?.includes(submission.id)) continue;
    if (submission.reviewers.some((r) => r.email === remaining[i])) continue;

    const pick = remaining[i];
    remaining.splice(i, 1);
    remaining.push(pick);
    return {
      email: pick,
      method: "auto",
      rank: 999,
      pRank: 999,
      student: false,
      order: 999,
      submissionRank: 999,
    };
  }
  return {
    email: "",
    method: "auto",
    rank: 999,
    pRank: 999,
    student: false,
    order: 999,
    submissionRank: 999,
  };
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
        }
        for (let coAuthor of reviewer.coAuthors) {
          if (submission.authors.includes(coAuthor)) {
            forbidden = true;
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
  const maxBiddings = 500;
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

function penalizedRank(reviewer: Bidding, autoPenalty: number) {
  return reviewer.method === "auto"
    ? reviewer.rank + autoPenalty
    : reviewer.rank;
}

function hashToNumber(str: string) {
  const hashStr = hash(str);
  return parseInt(hashStr.slice(0, 8), 16);
}
