"use client";

import { Error } from "@/components/ui/error";
import { Loading } from "@/components/ui/loading";
import { useAllData, useProject } from "@/hooks/api";
import { GetReviewer, GetMetaSubmission } from "@/types";
import { FaEye } from "react-icons/fa";
import Invitations from "./Invitations";
import { use } from "react";

export default function BiddingPage(props: {
  params: Promise<{ project: string }>;
}) {
  const params = use(props.params);
  const projectId = Number(params.project);
  const project = useProject(projectId);
  const {
    data: reviewers,
    isLoading: reviewersLoading,
    error: reviewersError,
    mutate: mutateReviewers,
  } = useAllData<GetReviewer>({ projectId: projectId, what: "reviewers" });

  const submissions = useAllData<GetMetaSubmission>({
    projectId: projectId,
    what: "submissions",
    meta: true,
  });

  if (reviewersLoading || submissions.isLoading || project.isLoading)
    return <Loading />;
  if (!project.data) return <Error msg={project.error?.message || ""} />;
  if (reviewersError) return <Error msg={reviewersError.message} />;
  if (submissions.error) return <Error msg={submissions.error.message} />;

  return (
    <div className="mx-auto max-w-7xl grid grid-cols-1 gap-6 items-center  justify-center mt-6 w-full">
      <div className=" p-5 pt-0 whitespace-nowrap overflow-auto">
        <div className="flex flex-col gap-8 mt-2">
          <Invitations
            projectId={projectId}
            division={project.data.division}
            deadline={project.data.deadline.toDateString()}
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
