"use client";

import { useData, useProject } from "@/hooks/api";
import UploadSubmissions from "./UploadSubmissions";
import { Loading } from "@/components/ui/loading";
import { Error } from "@/components/ui/error";
import useFeatureExtractor from "@/hooks/useFeatureExtractor";
import { useState } from "react";
import UploadVolunteers from "./UploadVolunteers";
import {
  MdOutlineCheckBoxOutlineBlank,
  MdOutlineCheckBox,
} from "react-icons/md";

type Tab = "submissions" | "references" | "volunteers";
const tabs: Tab[] = ["submissions", "volunteers", "references"];

export default function UploadData({ projectId }: { projectId: number }) {
  const { modelStatus, extractFeatures } = useFeatureExtractor();
  const [selectedTab, setSelectedTab] = useState<Tab>("submissions");

  const submissions = useData(projectId, "submissions");
  const volunteers = useData(projectId, "volunteers");
  const references = useData(projectId, "references");
  const data = { submissions, volunteers, references };

  const { data: project, isLoading, error } = useProject(projectId);
  if (isLoading) return <Loading msg="Loading Project" />;
  if (error) return <Error msg={error.message} />;
  if (!project) return null; //shouldn't happen, but typescript

  return (
    <div className="w-full max-w-lg  ">
      <h3 className="text-center">Upload Data</h3>
      <div className="flex flex-wrap gap-3 mb-6">
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
      <div
        key="submissions"
        className={selectedTab === "submissions" ? "" : "hidden"}
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
        className={selectedTab === "volunteers" ? "" : "hidden"}
      >
        <UploadVolunteers projectId={project.id} dataPage={data.volunteers} />
      </div>
      <div
        key="references"
        className={selectedTab === "references" ? "" : "hidden"}
      >
        <UploadSubmissions
          projectId={project.id}
          modelStatus={modelStatus}
          dataPage={data.references}
          extractFeatures={extractFeatures}
          reference
        />
      </div>
    </div>
  );
}
