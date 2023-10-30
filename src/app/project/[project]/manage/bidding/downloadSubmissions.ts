import { rankedSubmissions } from '@/lib/computeRelevantSubmissions';
import { GetReviewer, GetMetaSubmission, Bidding } from '@/types';

export default function downloadSubmissions(
  reviewers: GetReviewer[],
  submissions: GetMetaSubmission[],
  which: 'submissions' | 'reviewers'
) {
  const reviewersPerSubmission = 3; // TODO: make this a parameter
  const biddingMap = new Map<number, Bidding[]>();
  const reviewerCount = new Map<string, number>();
  const forbiddenAssignments = getForbiddingAssignments(reviewers, submissions);

  // copy so we don't mutate the original
  submissions = submissions.map((submission) => ({ ...submission }));
  reviewers = reviewers.map((reviewer) => ({ ...reviewer, biddings: [...reviewer.biddings] }));

  // for biddings not made, add biddings based on similarity
  reviewers = fillMissingBiddings(reviewers, submissions, forbiddenAssignments);

  for (const reviewer of reviewers) {
    let i = 0;
    reviewerCount.set(reviewer.email, 0);
    for (const internalId of reviewer.biddings) {
      if (!biddingMap.has(internalId)) biddingMap.set(internalId, []);

      const biddingsArray = biddingMap.get(internalId);

      // for automatically added biddings, add penalty so matching is favoured
      // for reviewers that bidded manually
      const penalty = reviewer.manualBiddings ? 0 : 5;

      biddingsArray?.push({
        reviewer: reviewer.email,
        method: i >= reviewer.manualBiddings ? 'auto' : 'manual',
        rank: penalty + i++
      });
    }
  }

  const maxPerReviewer = Math.ceil(
    (submissions.length * reviewersPerSubmission) / reviewers.length
  );

  for (const submission of submissions) {
    // biddings is total set of biddings
    let biddings = biddingMap.get(submission.id);
    if (!biddings) {
      submission.reviewers = [];
      continue;
    }
    submission.biddings = biddings;

    // compute selected [reviewersPerSubmission] reviewers
    // remove reviewers that have already been assigned maxPerReviewer submissions
    biddings = biddings.filter((b) => (reviewerCount.get(b.reviewer) || 0) < maxPerReviewer);
    // remove reviewers that are forbidden to review this submission
    biddings = biddings.filter((b) => !forbiddenAssignments[b.reviewer]?.includes(submission.id));
    // shuffle so no reviewers are more likely to get their preference
    biddings.sort(() => Math.random() - 0.5);
    // then sort by rank and reviewerCount (i.e. how often reviewer has already been assigned)
    biddings.sort((a: Bidding, b: Bidding) => {
      const aCount = reviewerCount.get(a.reviewer) || 0;
      const bCount = reviewerCount.get(b.reviewer) || 0;
      const combinedRankA = a.rank + aCount * 2;
      const combinedRankB = b.rank + bCount * 2;
      return combinedRankA - combinedRankB;
    });

    submission.reviewers = biddings.slice(0, reviewersPerSubmission).map((b) => b.reviewer);
    submission.reviewers.forEach((reviewer) => {
      reviewerCount.set(reviewer, (reviewerCount.get(reviewer) || 0) + 1);
    });
  }

  submissions = fillRemaining(
    submissions,
    reviewerCount,
    reviewersPerSubmission,
    forbiddenAssignments
  );

  if (which === 'submissions') {
    return submissions.map((submission) => {
      const data: Record<string, any> = {
        bidding_id: submission.id,
        ica_id: submission.submissionId,
        title: submission.title,
        authors: submission.authors.map((author) => author.email).join(', ')
      };
      for (let i = 0; i < submission.reviewers.length; i++) {
        data['reviewer_' + (i + 1)] = submission.reviewers[i];
      }
      //data.biddings = JSON.stringify(data.biddings);
      return data;
    });
  }
  if (which === 'reviewers') {
    const data: Record<string, Record<string, string>> = {};
    let maxCols = 0;
    for (const submission of submissions) {
      for (const reviewer of submission.reviewers) {
        if (!data[reviewer]) data[reviewer] = { reviewer };
        const nSubmissions = Object.keys(data[reviewer]).length - 1;
        maxCols = Math.max(maxCols, nSubmissions);
        data[reviewer]['submission_' + (nSubmissions + 1)] = submission.submissionId;
      }
    }
    return Object.values(data).map((row) => {
      for (let i = Object.keys(row).length - 1; i < maxCols; i++) {
        if (!row['submission_' + (i + 1)]) row['submission_' + (i + 1)] = '';
      }
      return row;
    });
  }
}

function fillRemaining(
  submissions: GetMetaSubmission[],
  reviewerCount: Map<string, number>,
  reviewersPerSubmission: number,
  forbiddenAssignments: Record<string, number[]>
) {
  // if any submissions have less than 3 biddings, we need to fill them up randomly.
  // (this should be uncommon if not impossible with the automatic matching algorithm)
  const remaining = Array.from(reviewerCount)
    .map(([email, count]) => ({ email, count }))
    .sort((a, b) => a.count - b.count)
    .map((a) => a.email);

  for (const submission of submissions) {
    for (let i = 0; i < reviewersPerSubmission; i++) {
      if (!submission.reviewers[i]) {
        submission.reviewers[i] = pickNext(remaining, submission, forbiddenAssignments) || '';
      }
    }
  }

  return submissions;
}

function pickNext(
  remaining: string[],
  submission: GetMetaSubmission,
  forbiddenAssignments: Record<string, number[]>
) {
  for (let i = 0; i < remaining.length; i++) {
    if (forbiddenAssignments[remaining[i]]?.includes(submission.id)) continue;
    if (submission.reviewers.includes(remaining[i])) continue;

    const pick = remaining[i];
    remaining.splice(i, 1);
    remaining.push(pick);
    return pick;
  }
}

function getForbiddingAssignments(reviewers: GetReviewer[], submissions: GetMetaSubmission[]) {
  // ensure no-one is assigned to own submission, or submission by a co-author
  // (also excluding submissions by co-authors that they are not on themselves)
  const forbiddenAssignments: Record<string, number[]> = {};

  for (let submission of submissions) {
    for (let reviewer of reviewers) {
      const authors = submission.authors.map((author) => author.email);
      let forbidden = false;
      if (authors.includes(reviewer.email)) forbidden = true;
      for (let coAuthor of reviewer.coAuthors) {
        if (authors.includes(coAuthor)) {
          forbidden = true;
          break;
        }
      }
      if (forbidden) {
        if (!forbiddenAssignments[reviewer.email]) forbiddenAssignments[reviewer.email] = [];
        forbiddenAssignments[reviewer.email].push(submission.id);
      }
    }
  }

  return forbiddenAssignments;
}

function fillMissingBiddings(
  reviewers: GetReviewer[],
  submissions: GetMetaSubmission[],
  forbiddenAssignments: Record<string, number[]>
) {
  for (let reviewer of reviewers) {
    if (reviewer.biddings.length > 20) continue;

    const allowedSubmissions = submissions.filter((submission) => {
      const forbiddenSubmissions = forbiddenAssignments[reviewer.email] || [];
      return !forbiddenSubmissions.includes(submission.id);
    });

    const ranked = rankedSubmissions(allowedSubmissions, reviewer.submissions);
    let ranked_i = 0;

    for (let bidding_i = 0; bidding_i < 20; bidding_i++) {
      if (reviewer.biddings[bidding_i]) continue;

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
