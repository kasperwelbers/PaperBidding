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
  MdVideoCameraFront,
} from "react-icons/md";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FaCheck, FaUpload, FaVideo } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import Step from "./Step";
import useInstitutionData from "@/hooks/useInstitutionResolver";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ProjectStatus } from "./page";
import { ScholarOneLink } from "./assignments/shared";
import ReferencePool from "./ReferencePool";

export default function UploadData({
  projectId,
  setStatus,
}: {
  projectId: number;
  setStatus: (status: ProjectStatus) => void;
}) {
  const { modelStatus, extractFeatures } = useFeatureExtractor();
  const institutionResolver = useInstitutionData();

  const { data: project, isLoading, error } = useProject(projectId);
  const submissions = useData(projectId, "submissions", { meta: true });
  const references = useData(projectId, "submissions", {
    reference: true,
    meta: true,
  });
  const volunteers = useData(projectId, "volunteers", { meta: true });
  const data = { submissions, volunteers, references };

  const [submissionsDialog, setSubmissionsDialog] = useState(false);
  const [volunteersDialog, setVolunteersDialog] = useState(false);
  const [referencesDialog, setReferencesDialog] = useState(false);

  useEffect(() => {
    if (submissions.isLoading || volunteers.isLoading) return;
    const status = {
      submissions: (submissions?.data?.length || 0) > 0,
      volunteers: (volunteers?.data?.length || 0) > 0,
    };
    setStatus(status);
  }, [
    submissions.isLoading,
    submissions.data,
    volunteers.isLoading,
    volunteers.data,
    setStatus,
  ]);

  if (isLoading || !institutionResolver.ready)
    return <Loading msg="Loading Project" />;
  if (error) return <Error msg={error.message} />;
  if (!project) return null; //shouldn't happen, but typescript

  return (
    <>
      {/* <h3 className="">Project data</h3> */}

      <Dialog open={submissionsDialog} onOpenChange={setSubmissionsDialog}>
        <DialogTrigger asChild>
          <Step
            title="Step 1. Upload submissions"
            hint="Upload submissions CSV (click for instructions)"
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
              Upload a CSV file with the submitted abstracts.
            </DialogDescription>
          </DialogHeader>
          <SubmissionCSVInstruction created={project.created} />
          <div className="flex items-center mt-6">
            <UploadSubmissions
              projectId={project.id}
              modelStatus={modelStatus}
              dataPage={data.submissions}
              extractFeatures={extractFeatures}
              institutionResolver={institutionResolver}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={volunteersDialog} onOpenChange={setVolunteersDialog}>
        <DialogTrigger asChild>
          <Step
            disabled={!submissions?.n}
            title="Step 2. Upload reviewers"
            hint="Add volunteer reviewers by email"
            doneMsg={`Assigned ${volunteers.n} reviewer${volunteers.n === 1 ? "" : "s"}`}
            done={!!volunteers?.n}
            loading={volunteers.isLoading}
          />
        </DialogTrigger>
        <DialogContent
          className="flex flex-col w-[800px] max-w-[95vw]"
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogHeader>
            <DialogTitle>Add reviewers</DialogTitle>
            <DialogDescription>
              Upload a CSV file with the reviewers for your division. Only
              reviewers that said they are willing to review will be included.
            </DialogDescription>
          </DialogHeader>
          <ReviewerCSVInstruction created={project.created} />
          <UploadVolunteers
            projectId={project.id}
            dataPage={data.volunteers}
            institutionResolver={institutionResolver}
            closeDialog={() => setVolunteersDialog(false)}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={referencesDialog} onOpenChange={setReferencesDialog}>
        <DialogTrigger asChild>
          <Step
            disabled={!submissions?.n || !volunteers?.n}
            optional
            title="Step 3. Add reference submissions"
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
            <DialogTitle>Upload Reference Submissions</DialogTitle>
            <DialogDescription>
              Reviewers are automatically matched to abstracts based on
              similarity to their own submissions. This affects both the bidding
              process and matching for reviewers that did not bid. You can
              upload ICA submissions from other division or previous years here to improve accuracy
            </DialogDescription>
          </DialogHeader>
          <ReferencePool projectId={project.id} />
          <UploadSubmissions
            projectId={project.id}
            modelStatus={modelStatus}
            dataPage={data.references}
            extractFeatures={extractFeatures}
            institutionResolver={institutionResolver}
            reference={true}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function DownloadCVSVideo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="text-blue-900 underline flex gap-2 w-max"
        >
          <FaVideo />
          show me
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[1000px]  overflow-auto">
        <div className="flex flex-col items-center min-w-[800px] pt-6">
          <video id="instruction-video" autoPlay muted controls>
            <source src="/download_csv.webm" type="video/webm" />
          </video>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SubmissionCSVInstruction({ created }: { created: Date | string }) {
  const [manual, setManual] = useState(false);

  if (!manual)
    return (
      <div className="text-left mt-3 w-max prose-sm max-w-full">
        <div className="flex gap-3 items-center">
          <h6 className="m-0">How to get this CSV file</h6>
        </div>
        <ul className="list-disc list-inside min-w-0 leading-5">
          <li>
            Go to <ScholarOneLink created={created} />, open the <b>Admin</b>{" "}
            tab and go to <b>Search</b> (<b>Submissions</b> tab)
          </li>
          <li className="min-w-0">
            Under <b>Saved Searches</b> select{" "}
            <i>&quot;Paper Bidding (select division yourself)&quot;</i>. Then
            click <b>Actions</b>: <b>Load</b>
          </li>
          <li>
            Under <b>Search Criteria</b> use <i>Current Category</i> to select
            your division.{" "}
            <b className="text-red-700">
              Make sure to do this, or you will get the submissions of all
              divisions!
            </b>
          </li>
          <li>
            Optionally <b>save</b> the search so you can return to it. Then
            click <b>Run</b> at the bottom, and download the comma delimited
            file
          </li>
        </ul>
        <CheckSubmissionFile />
        <div className="mt-3 italic">
          If you cannot use the saved search, you can also{" "}
          <Button className="h-6 px-1 ml-2" onClick={() => setManual(true)}>
            do it manually
          </Button>
        </div>
      </div>
    );

  return (
    <div className="text-left mt-3 w-max prose-sm max-w-full">
      <div className="flex gap-3 items-center mb-3">
        <h6 className="m-0">How to get this CSV file</h6>
        <DownloadCVSVideo />
      </div>
      <ul className="list-disc list-inside leading-5">
        <li>
          Go to <ScholarOneLink created={created} />, open the <b>Admin</b> tab
          and go to <b>Search</b> (<b>Submissions</b> tab)
        </li>
        <li>
          In <b>Select Format</b> select <i>Comma delimited</i>
        </li>
        <li>
          In <b>Select Search Criteria</b> add <i>Current Category</i> and{" "}
          <i>ABSTRACT STATUS</i>
        </li>
        <li>
          Under <b>Search Criteria</b> use <i>Current Category</i> to select
          your division, and set <i>ABSTRACT STATUS</i> to{" "}
          <i>Submitted</i>, <i>Resubmitted</i> and <i>Scored</i>
        </li>
        <li>
          In <b>Select Display Items</b> add:{"    "}
          <b className="text-blue-700">TITLE</b>,{"  "}
          <b className="text-blue-700">ABSTRACT BODY</b>,{"  "}
          <b className="text-blue-700">AUTHORS (ADDRESS &#38; EMAIL)</b>,{"  "}
          <b className="text-blue-700">INSTITUTIONS (ALL)</b>
        </li>
        <li>
          Now click <b>Run</b> at the bottom
        </li>
      </ul>
      <CheckSubmissionFile />
      <div className="mt-3 italic">
        Instructions for using
        <Button className="h-6 px-1 ml-2" onClick={() => setManual(false)}>
          Saved Search
        </Button>
      </div>
    </div>
  );
}

function CheckSubmissionFile() {
  return (
    <div className="mt-3 text-sm border rounded p-2 bg-secondary/50 whitespace-normal max-w-[40rem]">
      <b>Check your file.</b> It needs the columns <b>CONTROL ID</b>,{" "}
      <b>TITLE</b>, <b>ABSTRACT BODY</b>, <b>AUTHORS (ADDRESS &#38; EMAIL)</b>{" "}
      and <b>INSTITUTIONS (ALL)</b>. Other columns are fine.{" "}
      <i>PRESENTER (EMAIL)</i> or <i>SUBMITTER (EMAIL)</i> will <b>not</b> work
      in place of the authors column. After selecting the file, all column
      boxes should be filled. Processing can take a few minutes.
    </div>
  );
}

function ReviewerCSVInstruction({ created }: { created: Date | string }) {
  return (
    <div className="text-left mt-3 w-max prose-sm max-w-full">
      <div className="flex gap-3 items-center mb-3">
        <h6 className="m-0">How to get this CSV file</h6>
      </div>
      <ul className="list-disc list-inside leading-5">
        <li>
          Go to <ScholarOneLink created={created} />, open the <b>Admin</b> tab
          and go to <b>Search</b>
        </li>
        <li>
          At the top, select the <b>People</b> tab
        </li>
        <li>
          Under <b>Saved Searches</b> select{" "}
          <i>&quot;[Your division] Reviewers&quot;</i> (some divisions have a{" "}
          <i>&quot;…wID&quot;</i> variant). Then click <b>Actions</b>:{" "}
          <b>Load</b>. It should cover your division and all its areas of
          expertise
        </li>
        <li className="whitespace-normal">
          <b>Required:</b> make sure the <b>Display Items</b> include{" "}
          <b className="text-blue-700">PERSON (ID)</b>. If not, add it and save
          the search. This is needed to upload the assignments to ICA in Step
          6, and has to be stored now: if a reviewer later changes their email
          address in ScholarOne, we can no longer look it up
        </li>
        <li>
          Now click <b>Run</b> at the bottom, and download the file
        </li>
      </ul>
    </div>
  );
}
