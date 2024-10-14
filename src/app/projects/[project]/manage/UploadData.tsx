"use client";

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
  DialogHeader,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FaCheck, FaUpload } from "react-icons/fa";
import { Button } from "@/components/ui/button";
import { Check } from "lucide-react";

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
  const [selectedTab, setSelectedTab] = useState<Tab>("submissions");

  const { data: project, isLoading, error } = useProject(projectId);
  const submissions = useData(projectId, "submissions", { meta: true });
  const references = useData(projectId, "submissions", {
    reference: true,
    meta: true,
  });
  const volunteers = useData(projectId, "reviewers", { volunteer: true });
  const data = { submissions, volunteers, references };

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

  function hintOrStatus(what: "submissions" | "reviewers" | "references") {
    let msg = "";
    let done = false;
    if (what === "submissions") {
      if (submissions?.n) {
        done = true;
        msg = `${submissions.n} submissions`;
      } else {
        msg = "Upload the submissions to bid on";
      }
    }
    if (what === "reviewers") {
      if (volunteers?.n) {
        done = true;
        msg = `${volunteers.n} volunteers`;
      } else {
        msg = "Upload the volunteers to bid on";
      }
    }
    if (what === "references") {
      if (references?.n) {
        done = true;
        msg = `${references.n} references`;
      } else {
        msg = "Upload the references to bid on";
      }
    }

    return (
      <p className="italic opacity-70 flex gap-3 items-center">
        {done ? <FaCheck color="green" /> : null}
        {msg}
      </p>
    );
  }

  return (
    <div className="w-full max-w-lg flex flex-col gap-3 h-full min-h-[36rem]">
      <h3 className="text-center">Upload Data</h3>
      <div className="flex items-center">
        <div className="flex-auto">
          <h4 className="mb-0">Submissions</h4>
          {hintOrStatus("submissions")}
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>{!!submissions?.n ? <MdSettings /> : <FaUpload />}</Button>
          </DialogTrigger>
          <DialogContent onInteractOutside={(e) => e.preventDefault()}>
            <DialogHeader>
              <h4>Upload Submissions</h4>
            </DialogHeader>
            <UploadSubmissions
              projectId={project.id}
              modelStatus={modelStatus}
              dataPage={data.submissions}
              extractFeatures={extractFeatures}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center ">
        <div className="flex-auto">
          <h4 className="mb-0">
            <span className=" text-sm text-yellow-800 opacity-70">
              optional
            </span>
            {"   "}
            Volunteers
          </h4>
          <p className="italic opacity-70">
            Non-first authors can volunteer to review
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>{!!volunteers?.n ? <MdSettings /> : <FaUpload />}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <h4>Upload Submissions</h4>
            </DialogHeader>
            <UploadVolunteers
              projectId={project.id}
              dataPage={data.volunteers}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center ">
        <div className="flex-auto">
          <h4 className="mb-0">
            <span className=" text-sm text-yellow-800 opacity-70">
              optional
            </span>{" "}
            Previous Submissions
          </h4>
          <p className="italic opacity-70">
            More data for auto-assigning reviewers
          </p>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button>{!!references?.n ? <MdSettings /> : <FaUpload />}</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <h4>Upload Submissions</h4>
            </DialogHeader>
            <UploadSubmissions
              projectId={project.id}
              modelStatus={modelStatus}
              dataPage={data.references}
              extractFeatures={extractFeatures}
            />
          </DialogContent>
        </Dialog>
      </div>
      {/* <div className="flex flex-wrap gap-3 mb-6">
        {tabs.map((tab: Tab) => {
          const buttonColor =
            tab === selectedTab
              ? "bg-blue-500 text-white"
              : "bg-gray-300 text-black";

          return (
            <div
              key={tab}
              className={`flex-auto flex justify-center gap-2 items-center  h-11 rounded ${buttonColor} cursor-pointer px-3 py-2 text-center`}
              onClick={() => setSelectedTab(tab)}
            >
              {tab}

              {data[tab]?.data?.length ? (
                <MdOutlineCheckBox />
              ) : (
                <MdOutlineCheckBoxOutlineBlank />
              )}
            </div>
          );
        })}
      </div>
      <div className="flex-auto h-full flex flex-col">
        <div
          key="submissions"
          className={selectedTab === "submissions" ? "flex-auto" : "hidden"}
        >
          <UploadSubmissions
            projectId={project.id}
            modelStatus={modelStatus}
            dataPage={data.submissions}
            extractFeatures={extractFeatures}
          />
        </div>
        <div
          key="volunteers"
          className={selectedTab === "volunteers" ? "flex-auto" : "hidden"}
        >
          <UploadVolunteers projectId={project.id} dataPage={data.volunteers} />
        </div>
        <div
          key="references"
          className={selectedTab === "references" ? "flex-auto" : "hidden"}
        >
          <UploadSubmissions
            projectId={project.id}
            modelStatus={modelStatus}
            dataPage={data.references}
            extractFeatures={extractFeatures}
            reference
          />
        </div>
      </div> */}
    </div>
  );
}
