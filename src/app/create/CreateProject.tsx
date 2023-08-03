"use client";

import useFeatureExtractor from "@/hooks/useFeatureExtractor";
import { ProcessedSubmission } from "@/types";

export default function CreateProject() {
  const { modelStatus, prepareModel, extractFeatures } = useFeatureExtractor();

  return (
    <div>
      {modelStatus}
      <input onChange={() => onCreate("test", [])} />
    </div>
  );
}
