"use client";

import { Button } from "@/components/ui/button";
import { Error } from "@/components/ui/error";
import { Loading } from "@/components/ui/loading";
import {
  useAllData,
  useAssignments,
  useProject,
  useUploadAssignments,
} from "@/hooks/api";
import {
  GetReviewer,
  GetMetaSubmission,
  Bidding,
  BySubmission,
  ByReviewer,
} from "@/types";
import { useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaEye } from "react-icons/fa";
import { useCSVDownloader } from "react-papaparse";
import makeAssignments from "./makeAssignments";
import Link from "next/link";

export default function BiddingPage({
  params,
}: {
  params: { project: number };
}) {
  const [data, setData] = useState<{
    byReviewer: ByReviewer[];
    bySubmission: BySubmission[];
  }>();

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
  const {
    data: assignments,
    isLoading: assignmentsLoading,
    error: assignmentsError,
  } = useAssignments(params.project);

  const { trigger: uploadAssignments } = useUploadAssignments(params.project);

  useEffect(() => {
    if (assignments) {
      setData({
        byReviewer: assignments.byReviewer,
        bySubmission: assignments.bySubmission,
      });
    }
  }, [assignments]);

  if (reviewersLoading || submissionsLoading || projectLoading)
    return <Loading />;
  if (!project) return <Error msg={projectError?.message || ""} />;
  if (reviewersError) return <Error msg={reviewersError.message} />;
  if (submissionsError) return <Error msg={submissionsError.message} />;

  function updateAssignments() {
    if (!reviewers || !submissions) return;
    const data = makeAssignments(reviewers, submissions);
    uploadAssignments(data);
    setData(data);
  }

  return (
    <div className="grid max-w-7xl mx-auto grid-cols-1 lg:grid-cols-2 items-center lg:items-start justify-center mt-6 w-full">
      <div className="col-span-2 flex flex-col gap-3  mb-6 items-center mx-auto">
        <Button
          onClick={(e) => updateAssignments()}
          disabled={assignmentsLoading}
        >
          {data ? "Update" : "Compute"} assignments
        </Button>
        <div className="h-6">
          {assignments
            ? `Last updated: ${new Date(assignments.lastUpdate).toLocaleString()}`
            : null}
        </div>
      </div>
      <div className="p-5 pt-0  whitespace-nowrap overflow-auto">
        <h3 className="text-center">Reviewers by submission</h3>
        <ReviewersBySubmission
          bySubmission={data?.bySubmission}
          projectId={params.project}
        />
        d
      </div>
      <div className="p-5 pt-0  whitespace-nowrap overflow-auto">
        <div className="flex flex-col gap-8 ">
          <div className="p-5 pt-0  whitespace-nowrap overflow-auto">
            <h3 className="text-center">Submissions by reviewer</h3>
            <SubmissionsByReviewer
              byReviewer={data?.byReviewer}
              projectId={params.project}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ReviewersBySubmission({
  bySubmission,
  projectId,
}: {
  bySubmission: BySubmission[] | undefined;
  projectId: number;
}) {
  const { CSVDownloader, Type } = useCSVDownloader();
  if (!bySubmission) return null;

  return (
    <div className="p-5 pt-0  mt-3 flex flex-col gap-12">
      <CSVDownloader
        type={Type.Button}
        className="flex-auto w-full bg-secondary text-primary p-1 rounded hover:text-secondary hover:bg-primary transition-colors "
        filename={`submission_biddings_${projectId}.csv`}
        bom={true}
        disabled={!bySubmission}
        data={() => bySubmission}
      >
        Download CSV
      </CSVDownloader>
      <div className="flex flex-col gap-6">
        {bySubmission.map((d) => {
          return (
            <div key={d.submission_id} className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div className="px-3 py-1 h-min  bg-primary text-primary-foreground rounded">
                  {d.submission_id}
                </div>
                <div className="font-bold text-sm min-w-0 whitespace-break-spaces">
                  {d.title}
                </div>
              </div>
              <div className="flex flex-col gap-1 ml-6">
                {Object.keys(d).map((k) => {
                  if (!k.includes("reviewer_")) return null;
                  if (!d[k]) return null;
                  return <li key={k}>{d[k]}</li>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SubmissionsByReviewer({
  byReviewer,
  projectId,
}: {
  byReviewer: ByReviewer[] | undefined;
  projectId: number;
}) {
  const { CSVDownloader, Type } = useCSVDownloader();
  if (!byReviewer) return null;

  return (
    <div className="p-5 pt-0 mt-3 flex flex-col gap-12">
      <CSVDownloader
        type={Type.Button}
        className="flex-auto w-full bg-secondary text-primary p-1 rounded hover:text-secondary hover:bg-primary transition-colors "
        filename={`reviewer_biddings_${projectId}.csv`}
        bom={true}
        disabled={byReviewer}
        data={() => byReviewer}
      >
        Download CSV
      </CSVDownloader>
      <div className="flex flex-col gap-6">
        {byReviewer.map((d) => {
          return (
            <div key={d.reviewer} className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <div className="px-3 py-1 bg-primary text-primary-foreground rounded">
                  {d.reviewer}
                </div>
              </div>
              <div className="flex flex-col gap-1 ml-6">
                {Object.keys(d).map((k) => {
                  if (!k.includes("submission_")) return null;
                  if (!d[k]) return null;
                  return <li key={k}>{d[k]}</li>;
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
