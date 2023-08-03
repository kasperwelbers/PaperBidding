"use client";

import { useProject, useProjectUser } from "@/hooks/api";
import useFeatureExtractor from "@/hooks/useFeatureExtractor";

export default function Create() {
  useProject();
  useProjectUser();
  const { modelStatus, prepareModel, extractFeatures } = useFeatureExtractor();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-12">
      {modelStatus}
      <input />
    </main>
  );
}
