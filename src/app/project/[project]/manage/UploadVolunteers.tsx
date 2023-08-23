"use client";

import CSVReader from "@/components/ui/csvUpload";
import { Loading } from "@/components/ui/loading";
import { useDeleteData, useUploadData } from "@/hooks/api";
import { DataPage, ProcessedSubmission } from "@/types";
import { useState } from "react";
import ManageData from "./ManageData";

const submissionFields = ["email"];
const defaultFields = {
  email: "email",
};

interface Props {
  dataPage: DataPage;
  projectId: number;
}

export default function UploadVolunteers({ projectId, dataPage }: Props) {
  const [status, setStatus] = useState({ loading: "", error: "" });

  const { trigger: uploadVolunteers } = useUploadData(projectId, "reviewers", {
    volunteer: true,
  });
  const { trigger: deleteVolunteers } = useDeleteData(projectId, "reviewers", {
    volunteer: true,
  });

  async function onUpload(data: Record<string, string>[]) {
    const emails = data.map((row) => row.email);

    if (emails.length !== new Set(emails).size) {
      setStatus({ loading: "", error: "Duplicate email found" });
      return;
    }
    for (let i = 0; i < emails.length; i++) {
      if (!emails[i]) {
        setStatus({ loading: "", error: `Empty email found (row ${i + 2})` });
        return;
      }
    }

    setStatus({ loading: "Uploading", error: "" });

    try {
      const batchSize = 100;
      let batch: Record<string, any>[] = [];
      for (let i = 0; i < data.length; i++) {
        batch.push(data[i]);
        if (batch.length === batchSize || i === data.length - 1) {
          setStatus({
            loading: `Uploading ${Math.min(i + batchSize, data.length)}/${
              data.length
            }}`,
            error: "",
          });
          await uploadVolunteers({ data: batch });
          batch = [];
        }
      }
      setStatus({ loading: "", error: "" });
      dataPage.reset();
    } catch (e: any) {
      setStatus({ loading: "", error: e.message });
    }
  }

  if (status.loading) return <Loading msg={status.loading} />;
  if (dataPage.isLoading && !dataPage.data?.length)
    return <Loading msg="Loading Data" />;

  if (dataPage.data && dataPage.data.length > 0)
    return (
      <ManageData
        dataPage={dataPage}
        deleteData={deleteVolunteers}
        setStatus={setStatus}
      />
    );

  return (
    <>
      {status.error && <div className="text-red-500">{status.error}</div>}
      <CSVReader
        fields={submissionFields}
        label="Submissions"
        detail="Requires columns for person ID and email."
        onUpload={onUpload}
        defaultFields={defaultFields}
      />
    </>
  );
}
