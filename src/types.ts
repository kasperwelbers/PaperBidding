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
