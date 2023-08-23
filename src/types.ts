export type FeatureVector = number[];
export type ModelStatus = 'idle' | 'loading' | 'ready' | 'error';
export type FeatureExtractorCallback = (featureVectors: FeatureVector[]) => void;
export type ProgressCallback = (percent: number) => void;

export interface Submission {
  id: string;
  authors: string[];
  title: string;
  abstract: string;
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
  link: string;
}

export interface GetSubmission {
  id: number;
  title: string;
  features: FeatureVector;
  meanSimilarity?: number;
}
