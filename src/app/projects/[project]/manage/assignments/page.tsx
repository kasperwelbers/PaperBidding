"use client";

import { Button } from "@/components/ui/button";
import { Error } from "@/components/ui/error";
import { Loading } from "@/components/ui/loading";
import { useAllData, useProject } from "@/hooks/api";
import { GetReviewer, GetMetaSubmission, Bidding } from "@/types";
import { useMemo, useState } from "react";
import { FaArrowLeft, FaEye } from "react-icons/fa";
import { useCSVDownloader } from "react-papaparse";
import makeAssignments, { BySubmission } from "./makeAssignments";
import Link from "next/link";

export default function BiddingPage({
  params,
}: {
  params: { project: number };
}) {
  const { CSVDownloader, Type } = useCSVDownloader();

  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = useProject(params.project);
  const {
    data: reviewers,
    isLoading: reviewersLoading,
    error: reviewersError,
    mutate: mutateReviewers,
  } = useAllData<GetReviewer>(params.project, "reviewers");
  const {
    data: submissions,
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useAllData<GetMetaSubmission>(
    params.project,
    "submissions",
    undefined,
    true,
  );

  const data = useMemo(() => {
    return makeAssignments(reviewers || [], submissions || []);
  }, [submissions, reviewers]);

  if (reviewersLoading || submissionsLoading || projectLoading)
    return <Loading />;
  if (!project) return <Error msg={projectError?.message || ""} />;
  if (reviewersError) return <Error msg={reviewersError.message} />;
  if (submissionsError) return <Error msg={submissionsError.message} />;

  return (
    <div className="grid max-w-7xl mx-auto grid-cols-1 lg:grid-cols-2 items-center lg:items-start justify-center mt-6 w-full">
      <div className="p-5 pt-0  whitespace-nowrap overflow-auto">
        <h3 className="text-center">Reviewers by submission</h3>
        <CSVDownloader
          type={Type.Button}
          className="flex-auto w-full bg-secondary text-primary p-1 rounded hover:text-secondary hover:bg-primary transition-colors "
          filename={`submission_biddings_${params.project}.csv`}
          bom={true}
          data={() => data.bySubmission}
        >
          Download CSV
        </CSVDownloader>
        <ReviewersBySubmission bySubmission={data.bySubmission} />
      </div>
      <div className="p-5 pt-0  whitespace-nowrap overflow-auto">
        <div className="flex flex-col gap-8 mt-2">
          <div className="p-5 pt-0  whitespace-nowrap overflow-auto">
            <h3 className="text-center">Submissions by reviewer</h3>
            <CSVDownloader
              type={Type.Button}
              className="flex-auto w-full bg-secondary text-primary p-1 rounded hover:text-secondary hover:bg-primary transition-colors "
              filename={`reviewer_biddings_${params.project}.csv`}
              bom={true}
              data={() => data.byReviewer}
            >
              Download CSV
            </CSVDownloader>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewersBySubmission({
  bySubmission,
}: {
  bySubmission: BySubmission[] | undefined;
}): JSX.Element {
  if (!bySubmission) return <Loading />;

  return (
    <div className="p-5 pt-0  whitespace-nowrap overflow-auto mt-6 flex flex-col gap-6">
      {bySubmission.map((d) => {
        return (
          <div key={d.submission_id} className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <div className="px-3 py-1 bg-primary text-primary-foreground rounded">
                {d.submission_id}
              </div>
              <div className="font-bold whitespace-nowrap overflow-ellipsis overflow-hidden">
                <span title={d.title}> {d.title}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 ml-6">
              {Object.keys(d).map((k) => {
                if (!k.includes("reviewer_")) return null;
                return <li key={k}>{d[k]}</li>;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
