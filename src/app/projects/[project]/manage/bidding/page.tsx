"use client";

import { Error } from "@/components/ui/error";
import { Loading } from "@/components/ui/loading";
import { useAllData, useProject } from "@/hooks/api";
import { GetReviewer, GetMetaSubmission } from "@/types";
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
    <div className="mx-auto max-w-7xl w-full p-5 mt-6">
      <Invitations
        projectId={projectId}
        division={project.data.division}
        deadline={project.data.deadline.toDateString()}
        joinToken={project.data.joinToken}
        reviewers={reviewers || []}
        submissions={submissions.data || []}
        mutateReviewers={mutateReviewers}
        mutateProject={project.mutate}
      />
    </div>
  );
}
