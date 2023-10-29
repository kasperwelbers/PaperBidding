export type FeatureVector = number[];
export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';
export type FeatureExtractorCallback = (featureVectors: FeatureVector[]) => void;
export type ProgressCallback = (percent: number) => void;

export interface Submission {
  id: string;
  authors: Author[];
  title: string;
  abstract: string;
}

export interface Author {
  email: string;
  firstname: string;
}

export interface ProcessedSubmission extends Submission {
  features: FeatureVector;
}

export interface DataPage {
  data: Record<string, any>[] | undefined;
  isLoading: boolean;
  page: number;
  n: number | undefined;
  error: string | undefined;
  reset: () => void;
  setPage: (page: number) => void;
  nextPage?: () => void;
  prevPage?: () => void;
}

export interface Reviewer {
  id: number;
  email: string;
  bids: number[];
  submissionIds: number[];
  coAuthorSubmissionIds: number[];
}

export interface GetReviewer {
  id: number;
  email: string;
  firstname: string;
  link: string;
  invitationSent: string;
  biddings: number[];
}

export interface GetSubmission {
  id: number;
  title: string;
  features: FeatureVector;
  meanSimilarity?: number;
}

export interface GetMetaSubmission {
  id: number;
  title: string;
  submissionId: string;
  biddings?: Bidding[];
  reviewers: string[];
}

export interface Bidding {
  reviewer: string;
  rank: number;
}
