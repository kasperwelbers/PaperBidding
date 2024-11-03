"use client";

import { Button } from "@/components/ui/button";
import { Error } from "@/components/ui/error";
import { Loading } from "@/components/ui/loading";
import { useAllData, useProject } from "@/hooks/api";
import { GetReviewer, GetMetaSubmission, Bidding } from "@/types";
import { useState } from "react";
import { FaArrowLeft, FaEye } from "react-icons/fa";
import { useCSVDownloader } from "react-papaparse";
import Invitations from "./Invitations";
import Link from "next/link";

export default function BiddingPage({
  params,
}: {
  params: { project: number };
}) {
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

  if (reviewersLoading || submissionsLoading || projectLoading)
    return <Loading />;
  if (!project) return <Error msg={projectError?.message || ""} />;
  if (reviewersError) return <Error msg={reviewersError.message} />;
  if (submissionsError) return <Error msg={submissionsError.message} />;

  return (
    <div className="mx-auto max-w-7xl grid grid-cols-1 gap-6 items-center  justify-center mt-6 w-full">
      <div className=" p-5 pt-0 whitespace-nowrap overflow-auto">
        <div className="flex flex-col gap-8 mt-2">
          <Invitations
            projectId={params.project}
            division={project.division}
            deadline={project.deadline.toDateString()}
            reviewers={reviewers || []}
            mutateReviewers={mutateReviewers}
          />
        </div>
      </div>
      <div className="relative ">
        <ReviewerList reviewers={reviewers} />
      </div>
    </div>
  );
}

function ReviewerList({ reviewers }: { reviewers?: GetReviewer[] }) {
  if (!reviewers) return null;
  return (
    <div className="relative px-10  m-5 pt-0 mt-5 pb-5  border-b-2 border-primary">
      <h3>Reviewer List</h3>
      <table className="w-full table-auto [&_td]:px-2 [&_th]:p-2 [&_th:first-child]:rounded-l [&_th:last-child]:rounded-r ">
        <thead className="sticky top-0 text-left bg-slate-300">
          <tr>
            <th>email</th>
            <th className="text-right">invitation sent</th>
            <th className="text-right">bids</th>
            <th className="text-right"></th>
          </tr>
        </thead>
        <tbody>
          {reviewers.map((reviewer) => {
            const invitationSent = reviewer.invitationSent
              ? new Date(reviewer.invitationSent).toDateString()
              : "Not yet";
            return (
              <tr key={reviewer.email}>
                <td className="max-w-[15rem] overflow-hidden overflow-ellipsis whitespace-nowrap">
                  <span title={reviewer.email}>{reviewer.email}</span>
                </td>
                <td className="text-right">{invitationSent}</td>
                <td className="text-right">{reviewer?.biddings?.length}</td>
                <td className="text-right">
                  <a href={reviewer.link}>
                    <div className="border-2 border-primary rounded p-1 m-1 mr-0 w-8 flex justify-center">
                      <FaEye />
                    </div>
                  </a>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
