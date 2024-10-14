"use client";

import { useProject } from "@/hooks/api";
import { Loading } from "@/components/ui/loading";
import { Error } from "@/components/ui/error";
import { useState } from "react";

import UploadData from "./UploadData";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import ProjectAdmins from "./ProjectAdmins";

type Tab = "submissions" | "references" | "volunteers";
const tabs: Tab[] = ["submissions", "volunteers", "references"];

export default function ProjectPage({
  params,
}: {
  params: { project: number };
}) {
  const {
    data: project,
    isLoading,
    error,
    mutate,
  } = useProject(params.project);
  const router = useRouter();
  const [status, setStatus] = useState<Record<string, boolean>>();
  if (isLoading) return <Loading msg="Loading Project" />;
  if (error) return <Error msg={error.message} />;
  if (!project) return null; //shouldn't happen, but typescript

  return (
    <main className="flex justify-center">
      <div className="grid grid-cols-1 md:grid-cols-2 max-w-7xl p-3 lg:p-9  gap-8">
        <div className="flex flex-col  md:min-h-[32rem] p-3">
          <ProjectAdmins project={project} mutateProject={mutate} />

          <div className="mt-8">
            <h3 className="text-left">Preparing a project</h3>
            <div className="py-3">
              <p>
                First upload a <b>submissions</b> CSV. By default, every
                submission author is considered as a possible reviewer.
                Alternatively, you can upload a CSV file with a CSV of{" "}
                <b>volunteers</b>.
              </p>
              <p>
                Reviewers will be asked to bid on submissions, which will be
                sorted by similarity to their own submissions. If you have
                submissions from previous projects, you can upload them as{" "}
                <b>reference</b> submissions to improve this automatic matching.
              </p>
            </div>
          </div>
          <p className="text-red-600 mt-auto">
            {!status || status.submissions
              ? ""
              : "Need to upload submissions first"}
          </p>
          <Button
            disabled={!status?.submissions}
            className="w-full "
            onClick={() =>
              router.push(`/projects/${project.id}/manage/bidding`)
            }
          >
            Manage bidding
          </Button>
        </div>
        <div className="border border-primary p-3 rounded-lg flex justify-center items-center h-full">
          <UploadData projectId={params.project} setStatus={setStatus} />
        </div>
      </div>
    </main>
  );
}
