"use client";

import CSVReader from "@/components/ui/csvUpload";
import { Loading } from "@/components/ui/loading";
import { useDeleteData, useUploadData } from "@/hooks/api";
import { DataPage, ProcessedSubmission } from "@/types";
import { useEffect, useState } from "react";
import ManageData from "./ManageData";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FaSave } from "react-icons/fa";
import { ZodError, ZodIssue, z } from "zod";
import Markdown from "react-markdown";

const submissionFields = [
  { field: "email", label: "Email" },
  { field: "firstname", label: "First Name" },
];
const defaultFields = {
  email: "email",
  firstname: "first name",
};

interface Props {
  dataPage: DataPage;
  projectId: number;
}

export default function UploadVolunteers({ projectId, dataPage }: Props) {
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
    const emails = data.map((row) => row.email);

    try {
      z.array(z.string().email()).parse(emails);
    } catch (e) {
      if (e instanceof z.ZodError) {
        const invalidIndex = e.errors.map((e) => e.path[0]);
        const invalidEmails = invalidIndex.map((i) => emails[Number(i)]);
        setStatus({
          loading: "",
          error: "#### Invalid email\n\n* " + invalidEmails.join("\n* "),
        });
        return;
      }
    }

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
      await uploadVolunteers({ data });
      setStatus({ loading: "", error: "" });
      dataPage.reset();
    } catch (e: any) {
      setStatus({ loading: "", error: e.message });
    }
  }

  // if (status.loading) return <Loading msg={status.loading} />;
  if (dataPage.isLoading && !dataPage.data?.length)
    return <Loading msg="Loading Data" />;

  const hasChanged = reviewers.trim() !== reviewerString(dataPage).trim();

  return (
    <div className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
      <form
        className="flex flex-col gap-2 "
        onSubmit={(e) => {
          e.preventDefault();
          const r = reviewers
            .split("\n")
            .map((r) => ({
              email: r.trim(),
            }))
            .filter((r) => r.email);
          onUpload(r);
        }}
      >
        <Textarea
          rows={10}
          placeholder="One reviewer email per line"
          value={reviewers}
          onChange={(d) => setReviewers(d.target.value)}
        />
        <Button
          disabled={!!status.loading || !hasChanged}
          className=" flex-auto"
        >
          {hasChanged ? "Save Changes" : "No Changes"}
        </Button>
      </form>
      <div>
        {status.error ? (
          <Markdown className="text-red-500 p-2">{status.error}</Markdown>
        ) : (
          <div className="p-2 text-sm italic whitespace-break-spaces">
            {`Add the email addresses of any volunteers.\n\nDon't worry about accidentally adding volunteers that are already first-authors. We'll just ignore those`}
          </div>
        )}
      </div>
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
