export type FeatureVector = number[];
export type ModelStatus = "idle" | "loading" | "ready" | "error";
export type FeatureExtractorCallback = (
  featureVectors: FeatureVector[],
) => void;
export type ProgressCallback = (percent: number) => void;

export interface Submission {
  id: string;
  authors: string[];
  institutions: string[];
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

export interface Admin {
  email: string;
}

export interface NoResponse {}

export interface Reviewer {
  id: number;
  email: string;
  firstname: string;
  bids: number[];
  submissionIds: number[];
  conflictSubmissionIds: number[];
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
  institution: string;
  link: string;
  invitationSent: Date | null;
  biddings: number[];
  manualBiddings: number;
  coAuthors: string[];
  submissions: OwnSubmission[];
  volunteer: boolean;
}

export interface GetVolunteer {
  id: number;
  email: string;
}
export interface GetProject {
  id: number;
  name: string;
  division: string;
  deadline: Date;
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

export interface RankedReviewer {
  email: string;
  rank: number;
  pRank: number;
  method: "auto" | "manual";
}

export interface GetMetaSubmission {
  id: number;
  title: string;
  submissionId: string;
  biddings?: Bidding[];
  reviewers: RankedReviewer[];
  backupReviewers: RankedReviewer[];
  authors: string[];
  institutions: string[];
}

export interface Bidding {
  reviewer: string;
  rank: number;
  pRank: number;
  method: "auto" | "manual";
}

export interface BySubmission {
  submission_id: string;
  title: string;
  authors: string;
  [key: string]: string;
}

export interface ByReviewer {
  reviewer: string;
  [key: string]: string;
}

export interface AssignmentSettings {
  reviewersPerSubmission: number;
  autoPenalty: number;
}
