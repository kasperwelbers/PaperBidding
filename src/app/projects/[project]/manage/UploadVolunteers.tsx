"use client";

import CSVReader from "@/components/ui/csvUpload";
import { Loading } from "@/components/ui/loading";
import { useDeleteData, useUploadData } from "@/hooks/api";
import { DataPage, ProcessedSubmission, UploadReviewer } from "@/types";
import { useEffect, useState } from "react";
import ManageData from "./ManageData";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FaSave } from "react-icons/fa";
import { ZodError, ZodIssue, z } from "zod";
import Markdown from "react-markdown";
import { InstitutionResolver } from "@/hooks/useInstitutionResolver";

const volunteerFields = [
  { field: "email", label: "Email" },
  { field: "institution", label: "Institution" },
  { field: "student", label: "Student designation" },
  { field: "reviewer", label: "Reviewer flag" },
];
const defaultFields = {
  email: "email",
  institution: "institution",
  student: "student",
  reviewer: "reviewer",
};

interface Props {
  dataPage: DataPage;
  projectId: number;
  institutionResolver: InstitutionResolver;
  closeDialog: () => void;
}

export default function UploadVolunteers({
  projectId,
  dataPage,
  institutionResolver,
  closeDialog,
}: Props) {
  const [status, setStatus] = useState({ loading: "", error: "" });
  const [reviewers, setReviewers] = useState<string>("");

  useEffect(() => {
    setReviewers(reviewerString(dataPage));
  }, [dataPage]);

  const { trigger: uploadVolunteers } = useUploadData(projectId, "volunteers", {
    volunteer: true,
  });
  const { trigger: deleteVolunteers } = useDeleteData(projectId, "volunteers", {
    volunteer: true,
  });

  async function onUpload(data: Record<string, string>[]) {
    setStatus({ loading: "loading", error: "" });

    if (!institutionResolver.ready) {
      setStatus({ loading: "", error: "Institution data not loaded" });
      return;
    }

    const body: UploadReviewer[] = [];

    for (let row of data) {
      const institution = institutionResolver.resolve(
        row.email,
        row.institution,
      );

      const notStudent =
        !row.student || row.student === "No" || row.student === "no";
      const cannotReview = row.reviewer === "No" || row.reviewer === "no";

      body.push({
        email: row.email,
        institution: institution,
        student: !notStudent,
        canReview: !cannotReview,
      });
    }

    setStatus({ loading: "Uploading", error: "" });
    try {
      await uploadVolunteers({ data: body });
      setStatus({ loading: "", error: "" });
      dataPage.reset();
      closeDialog();
    } catch (e: any) {
      setStatus({ loading: "", error: e.message });
    }
  }

  // if (status.loading) return <Loading msg={status.loading} />;
  if (dataPage.isLoading && !dataPage.data?.length)
    return <Loading msg="Loading Data" />;

  const hasChanged = reviewers.trim() !== reviewerString(dataPage).trim();

  return (
    <div className="mt-6">
      {status.error && <div className="text-red-500">{status.error}</div>}
      <CSVReader
        fields={volunteerFields}
        label="Volunteers"
        detail="Requires columns for id, author (email and firstname), title and abstract. Use multiple rows for different
      authors."
        onUpload={onUpload}
        defaultFields={defaultFields}
      />
      {dataPage.data && dataPage.data.length > 0 ? (
        <div className="mt-16 border-t-2 pt-6">
          <h3>Current Data</h3>
          <ManageData
            dataPage={dataPage}
            deleteData={deleteVolunteers}
            setStatus={setStatus}
          />
        </div>
      ) : null}
    </div>
  );

  // if (dataPage.data && dataPage.data.length > 0)
  //   return (
  //     <ManageData
  //       dataPage={dataPage}
  //       deleteData={deleteVolunteers}
  //       setStatus={setStatus}
  //     />
  //   );

  // return (
  //   <>
  //     {status.error && <div className="text-red-500">{status.error}</div>}
  //     <CSVReader
  //       fields={submissionFields}
  //       label="Submissions"
  //       detail="Requires columns for person ID and email."
  //       onUpload={onUpload}
  //       defaultFields={defaultFields}
  //     />
  //   </>
  // );
}

function reviewerString(dataPage: DataPage) {
  if (!dataPage.data) return "";
  return dataPage.data
    .map((r) => r.email)
    .sort()
    .join("\n");
}
