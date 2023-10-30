import { GetSubmission, Reviewer, FeatureVector, OwnSubmission } from '@/types';

export function computeRelevantSubmissions(submissions?: GetSubmission[], reviewer?: Reviewer) {
  // sort submissions by relevance to reviewer
  // also filter out the reviewer's own submissions, and submissions by co-authors
  if (!submissions) return undefined;
  if (!reviewer) return undefined;

  const filteredSubmissions = submissions.filter(
    (submission) =>
      !reviewer.submissionIds.includes(submission.id) &&
      !reviewer.coAuthorSubmissionIds.includes(submission.id)
  );

  return rankedSubmissions(filteredSubmissions, reviewer.submissions);
}

export function rankedSubmissions(submissions: any[], ownSubmissions: OwnSubmission[]) {
  const rankedSubmissions = submissions.map((submission) => {
    submission.meanSimilarity = 0; // start with 0, so that if there are no own submissions, the mean is 0
    for (const ownSubmission of ownSubmissions) {
      submission.meanSimilarity += cosineSimilarity(submission.features, ownSubmission.features);
    }
    submission.meanSimilarity /= Math.max(1, ownSubmissions.length - 1);

    return submission;
  });

  return rankedSubmissions.sort((a, b) => (b?.meanSimilarity || 0) - (a?.meanSimilarity || 0));
}

function cosineSimilarity(a: FeatureVector, b: FeatureVector) {
  if (a.length === 0 || a.length !== b.length) return NaN;
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}
