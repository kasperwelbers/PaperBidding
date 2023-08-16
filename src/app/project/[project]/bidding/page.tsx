"use client";

import { useAllData } from "@/hooks/api";

export default function Bidding({ params }: { params: { project: number } }) {
  const { allData, isLoading } = useAllData(params.project, "reviewers");
  return (
    <div>
      <h1>Bidding</h1>
      {allData?.map((reviewer) => (reviewer.email ? reviewer.email : ""))}
      {isLoading}
    </div>
  );
}
