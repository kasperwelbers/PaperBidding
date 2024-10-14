export type FeatureVector = number[];
export type ModelStatus = "idle" | "loading" | "ready" | "error";
export type FeatureExtractorCallback = (
  featureVectors: FeatureVector[],
) => void;
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
  firstname: string;
  bids: number[];
  submissionIds: number[];
  coAuthorSubmissionIds: number[];
  submissions: OwnSubmission[];
}

export interface OwnSubmission {
  id: number;
  title?: string;
  submissionId: string;
  features: FeatureVector;
}

export interface GetReviewer {
  id: number;
  email: string;
  firstname: string;
  link: string;
  invitationSent: string;
  biddings: number[];
  manualBiddings: number;
  coAuthors: string[];
  submissions: OwnSubmission[];
  volunteer: boolean;
}

export interface GetVolunteer {
  id: number;
  email: string;
  firstname: string;
}

export interface GetProject {
  id: number;
  name: string;
  created: string;
  creator: string;
  admins: string[];
  archived: boolean;
}

export interface GetInvitation {
  label: string;
  link: string;
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
  authors: Author[];
}

export interface Bidding {
  reviewer: string;
  rank: number;
  method: "auto" | "manual";
}
