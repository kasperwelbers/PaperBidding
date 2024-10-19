import { useData, useProject } from "@/hooks/api";
import UploadSubmissions from "./UploadSubmissions";
import { Loading } from "@/components/ui/loading";
import { Error } from "@/components/ui/error";
import useFeatureExtractor from "@/hooks/useFeatureExtractor";
import { useEffect, useState } from "react";
import UploadVolunteers from "./UploadVolunteers";
import {
  MdOutlineCheckBoxOutlineBlank,
  MdOutlineCheckBox,
  MdSettings,
} from "react-icons/md";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FaCheck, FaUpload } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Check, CheckSquare, Square } from "lucide-react";
import Step from "./Step";

type Tab = "submissions" | "references" | "volunteers";
const tabs: Tab[] = ["submissions", "volunteers", "references"];

export default function UploadData({
  projectId,
  setStatus,
}: {
  projectId: number;
  setStatus: (status: Record<string, boolean>) => void;
}) {
  const { modelStatus, extractFeatures } = useFeatureExtractor();

  const { data: project, isLoading, error } = useProject(projectId);
  const submissions = useData(projectId, "submissions", { meta: true });
  const references = useData(projectId, "submissions", {
    reference: true,
    meta: true,
  });
  const volunteers = useData(projectId, "volunteers", { meta: true });
  const data = { submissions, volunteers, references };

  console.log(volunteers);

  useEffect(() => {
    if (submissions.isLoading) return;
    const status = {
      submissions: (submissions?.data?.length || 0) > 0,
    };
    setStatus(status);
  }, [submissions.isLoading, submissions.data, setStatus]);

  if (isLoading) return <Loading msg="Loading Project" />;
  if (error) return <Error msg={error.message} />;
  if (!project) return null; //shouldn't happen, but typescript

  return (
    <>
      {/* <h3 className="">Project data</h3> */}

      <Dialog>
        <DialogTrigger asChild>
          <Step
            title="Step 1. Upload submissions"
            hint="Upload a CSV file wih submissions"
            doneMsg={`Uploaded ${submissions.n} submission${submissions.n === 1 ? "" : "s"}`}
            done={!!submissions?.n}
            loading={submissions.isLoading}
          />
        </DialogTrigger>
        <DialogContent
          className="flex flex-col gap-3 "
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Upload Submissions</DialogTitle>
            <DialogDescription>
              Upload a CSV file with columns for the submission ID, Author
              email(s), Title and Abstract.
            </DialogDescription>
          </DialogHeader>
          <div className="text-left mt-3">
            <h6>How to get this CSV file</h6>
            <li>
              Go to{" "}
              <a
                target="_blank"
                rel="noreferrer"
                href="https://ica2025.abstractcentral.com"
                className="underline text-blue-900"
              >
                ScholarOne
              </a>{" "}
              and open the <b>Admin</b> tab
            </li>
            <li>
              Go to <b>Search</b>
            </li>
          </div>
          <div className="flex items-center mt-6 mx-auto">
            <UploadSubmissions
              projectId={project.id}
              modelStatus={modelStatus}
              dataPage={data.submissions}
              extractFeatures={extractFeatures}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Step
            disabled={!submissions?.n}
            optional
            title="Step 2. Add volunteers"
            hint="Add volunteer reviewers by email"
            doneMsg={`Assigned ${volunteers.n} volunteer${volunteers.n === 1 ? "" : "s"}`}
            done={!!volunteers?.n}
            loading={volunteers.isLoading}
          />
        </DialogTrigger>
        <DialogContent
          className="flex items-center flex-col"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Add volunteer reviewers</DialogTitle>
            <DialogDescription>
              This is optional, because first authors are made reviewers by
              default, and you can also send a general invitation link for the
              bidding process, where people can indicate willingness to review
              by bidding.
            </DialogDescription>
          </DialogHeader>
          <UploadVolunteers projectId={project.id} dataPage={data.volunteers} />
        </DialogContent>
      </Dialog>

      <Dialog>
        <DialogTrigger asChild>
          <Step
            disabled={!submissions?.n}
            optional
            title="Step 3. Add old submissions"
            hint="Improve automatic matching"
            doneMsg={`Uploaded ${references.n} submission${references.n === 1 ? "" : "s"}`}
            done={!!references?.n}
            loading={references.isLoading}
          />
        </DialogTrigger>
        <DialogContent
          className="flex items-center flex-col"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Upload Previous Submissions</DialogTitle>
            <DialogDescription>
              Reviewers are automatically matched to abstracts based on
              similarity to their own submissions. This affects both the bidding
              process and matching for reviewers that did not bid. You can
              upload old ICA submissions to improve accuracy
            </DialogDescription>
          </DialogHeader>
          <UploadSubmissions
            projectId={project.id}
            modelStatus={modelStatus}
            dataPage={data.references}
            extractFeatures={extractFeatures}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
