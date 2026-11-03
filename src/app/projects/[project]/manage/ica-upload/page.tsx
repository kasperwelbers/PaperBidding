"use client";

import { Button } from "@/components/ui/button";
import CSVReader, { CSVField } from "@/components/ui/csvUpload";
import { Error } from "@/components/ui/error";
import { Loading } from "@/components/ui/loading";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  useAllData,
  useAssignments,
  useProject,
  useProjectPersonIds,
  useUploadIcaPersons,
} from "@/hooks/api";
import Link from "next/link";
import { use, useMemo, useState } from "react";
import { useCSVDownloader } from "react-papaparse";
import { GetReviewer } from "@/types";
import {
  CopyText,
  ScholarOneLink,
  UploadAssignmentsVideo,
  computeIcaMatch,
  controlIdsByReviewer,
} from "../assignments/shared";

const matchingFields: CSVField[] = [
  { field: "email", label: "Email" },
  { field: "personId", label: "ICA Person ID" },
];
const matchingDefaultFields = {
  email: "person (email)",
  personId: "person (id)",
};

export default function IcaUploadPage(props: {
  params: Promise<{ project: string }>;
}) {
  const params = use(props.params);
  const projectId = Number(params.project);

  const { data: project, isLoading: projectLoading } = useProject(projectId);
  const {
    data: assignments,
    isLoading: assignmentsLoading,
    error: assignmentsError,
  } = useAssignments(projectId);
  const {
    data: personIds,
    isLoading: personIdsLoading,
    error: personIdsError,
    mutate: mutatePersonIds,
  } = useProjectPersonIds(projectId);

  // details about the reviewers (how they were added, bids), keyed by lowercased email
  const reviewers = useAllData<GetReviewer>({
    projectId,
    what: "reviewers",
    limit: 500,
  });
  const reviewerInfo = useMemo(() => {
    const info = new Map<string, GetReviewer>();
    for (const r of reviewers.data || [])
      info.set(r.email.trim().toLowerCase(), r);
    return info;
  }, [reviewers.data]);

  const match = useMemo(() => {
    if (!assignments || !personIds) return null;
    return computeIcaMatch(assignments.byReviewer, personIds);
  }, [assignments, personIds]);

  if (projectLoading || assignmentsLoading || personIdsLoading)
    return <Loading />;
  if (!project) return <Error msg="Could not load project" />;
  if (assignmentsError) return <Error msg={assignmentsError.message} />;
  if (personIdsError) return <Error msg={personIdsError.message} />;

  if (!assignments)
    return (
      <div className="max-w-3xl mx-auto p-6 mt-6">
        <h3>Step 6. Upload to ICA</h3>
        <p>
          There are no assignments yet. First compute the assignments in{" "}
          <Link
            href={`/projects/${projectId}/manage/assignments`}
            className="underline text-blue-900"
          >
            Step 5
          </Link>
          .
        </p>
      </div>
    );
  if (!match) return null;

  const allMatched = match.matched === match.assigned;

  return (
    <div className="max-w-3xl mx-auto p-3 lg:p-6 mt-6 flex flex-col gap-9 text-sm">
      <div>
        <h3>Step 6. Upload to ICA</h3>
        <p className="m-0">
          ICA (ScholarOne) imports reviewer assignments by <b>ICA Person ID</b>,
          so each reviewer email needs to be matched to a Person ID. Not every
          reviewer may be matched yet; if so, you&apos;ll see how to fix it
          below.
        </p>
      </div>

      {/* 1. Status */}
      <section
        className={`border rounded p-4 ${allMatched ? "bg-green-50 border-green-300" : "bg-secondary"}`}
      >
        <h4 className="mb-1">
          {match.matched} of {match.assigned} assigned reviewers have an ICA
          Person ID
        </h4>
        {allMatched ? (
          <p className="m-0">All assigned reviewers are matched.</p>
        ) : null}
      </section>

      {/* 2. Unmatched reviewers */}
      {!allMatched ? (
        <UnmatchedReviewers
          unmatchedEmails={match.unmatchedEmails}
          created={project.created}
          reviewerInfo={reviewers.data ? reviewerInfo : undefined}
          onUploaded={() => mutatePersonIds()}
        />
      ) : null}

      {/* 3. Download */}
      <DownloadIcaFile
        projectId={projectId}
        rows={match.rows}
        nUnmatched={match.assigned - match.matched}
      />

      {/* 4. Upload to ICA */}
      <section className="flex flex-col gap-2">
        <h4 className="mb-0">Upload to ICA</h4>
        <p className="m-0">
          Go to <ScholarOneLink created={project.created} />, and upload the
          file you just downloaded.
        </p>
        {/* TODO: add the exact ScholarOne menu path for the bulk reviewer
            assignment upload */}
        <p className="m-0 italic">
          Not sure where to upload it? Ask your ICA contact for the bulk
          reviewer assignment upload in ScholarOne.
        </p>
      </section>

      {/* 5. Fallback */}
      <ManualAssignment
        byReviewer={assignments.byReviewer}
        created={project.created}
      />
    </div>
  );
}

function UnmatchedReviewers({
  unmatchedEmails,
  created,
  reviewerInfo,
  onUploaded,
}: {
  unmatchedEmails: string[];
  created: Date | string;
  /** undefined while loading */
  reviewerInfo?: Map<string, GetReviewer>;
  onUploaded: () => void;
}) {
  const { trigger: uploadIcaPersons } = useUploadIcaPersons();
  const [status, setStatus] = useState({ loading: false, error: "", msg: "" });
  const [open, setOpen] = useState(false);

  async function onUpload(data: Record<string, string>[]) {
    setStatus({ loading: true, error: "", msg: "" });
    const persons = data
      .filter((row) => row.email?.trim() && row.personId?.trim())
      .map((row) => ({ email: row.email, personId: row.personId }));
    try {
      const res = await uploadIcaPersons({ data: persons });
      if (!res.ok) throw new globalThis.Error(res.statusText || "Upload failed");
      setStatus({
        loading: false,
        error: "",
        msg: `Uploaded ${persons.length} email / Person ID pairs`,
      });
      onUploaded();
    } catch (e: any) {
      setStatus({ loading: false, error: e.message, msg: "" });
    }
  }

  return (
    <section className="border-2 border-amber-400 bg-amber-50 rounded p-4 flex flex-col gap-3">
      <h4 className="m-0 text-amber-900">
        ⚠ {unmatchedEmails.length} assigned reviewer
        {unmatchedEmails.length === 1 ? " has" : "s have"} no Person ID, so
        their assignments are left out of the ICA file
      </h4>

      <div className="bg-white rounded border max-h-96 overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>
                <span className="flex items-center gap-1">
                  Email <CopyText text={unmatchedEmails.join("\n")} />
                </span>
              </TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="w-48">Person ID</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {unmatchedEmails.map((email) => (
              <UnmatchedRow
                key={email}
                email={email}
                reviewer={reviewerInfo?.get(email.trim().toLowerCase())}
                loading={!reviewerInfo}
                onSaved={onUploaded}
              />
            ))}
          </TableBody>
        </Table>
      </div>

      <ol className="list-decimal list-inside leading-6 m-0">
        <li>
          <button
            className="underline text-blue-900 font-bold"
            onClick={() => setOpen(!open)}
          >
            Update the matching list
          </button>{" "}
          from ScholarOne. This fixes most cases.
        </li>
        <li>
          Still missing? Their ScholarOne email may have changed. Find them by
          name and enter the Person ID in the table.
        </li>
        <li>
          Not in ScholarOne at all (bidders using the general invitation link might not have registered, or used a different email address)?
          They need to create an ICA account first.
        </li>
      </ol>

      {open ? (
        <div className="bg-white rounded border p-3 flex flex-col gap-3">
          <p className="m-0">
            In <ScholarOneLink created={created} />: <b>Admin</b> →{" "}
            <b>Search</b> → <b>People</b>, without a division or category
            filter. Format <i>Comma delimited</i>, display items only{" "}
            <b>PERSON (EMAIL)</b> and <b>PERSON (ID)</b>. Run, and upload the
            file here. The list is shared by all divisions.
          </p>
          {status.error && <div className="text-red-500">{status.error}</div>}
          {status.msg && <div className="text-green-700">{status.msg}</div>}
          {status.loading ? (
            <Loading msg="Uploading" />
          ) : (
            <CSVReader
              fields={matchingFields}
              label="Matching list"
              detail="Requires columns for email and ICA Person ID"
              onUpload={onUpload}
              defaultFields={matchingDefaultFields}
            />
          )}
        </div>
      ) : null}
    </section>
  );
}

function UnmatchedRow({
  email,
  reviewer,
  loading,
  onSaved,
}: {
  email: string;
  reviewer?: GetReviewer;
  loading: boolean;
  onSaved: () => void;
}) {
  // reviewer list = Step 2 upload (from ScholarOne); invitation link = joined
  // via the general link, so possibly no ICA account
  let source = loading ? "…" : "not in reviewer list";
  if (reviewer)
    source = reviewer.selfRegistered ? "invitation link" : "reviewer list";

  return (
    <TableRow>
      <TableCell className="break-all">{email}</TableCell>
      <TableCell
        className={`whitespace-nowrap ${reviewer?.selfRegistered ? "text-amber-800 font-bold" : ""}`}
      >
        {source}
      </TableCell>
      <TableCell>
        <SetPersonId email={email} onSaved={onSaved} />
      </TableCell>
    </TableRow>
  );
}

/** Enter the Person ID of a single reviewer by hand (e.g., found by name in
 *  ScholarOne, because their email address changed) */
function SetPersonId({
  email,
  onSaved,
}: {
  email: string;
  onSaved: () => void;
}) {
  const { trigger: uploadIcaPersons } = useUploadIcaPersons();
  const [personId, setPersonId] = useState("");
  const [status, setStatus] = useState<"" | "saving" | "error">("");

  async function save() {
    if (!personId.trim()) return;
    setStatus("saving");
    try {
      const res = await uploadIcaPersons({
        data: [{ email, personId: personId.trim() }],
      });
      if (!res.ok) throw new globalThis.Error(res.statusText);
      setStatus("");
      onSaved();
    } catch (e) {
      setStatus("error");
    }
  }

  return (
    <form
      className="flex gap-1 items-center"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <input
        className="border rounded px-1 h-6 w-24 bg-white"
        placeholder="Person ID"
        value={personId}
        onChange={(e) => setPersonId(e.target.value)}
        disabled={status === "saving"}
      />
      <Button
        type="submit"
        size="sm"
        className="h-6 px-2 text-xs"
        disabled={!personId.trim() || status === "saving"}
      >
        {status === "saving" ? "…" : "Save"}
      </Button>
      {status === "error" ? (
        <span className="text-red-600" title="Saving failed">
          !
        </span>
      ) : null}
    </form>
  );
}

function DownloadIcaFile({
  projectId,
  rows,
  nUnmatched,
}: {
  projectId: number;
  rows: { "Person ID": string; "Control ID": string }[];
  nUnmatched: number;
}) {
  const { CSVDownloader, Type } = useCSVDownloader();

  return (
    <section className="flex flex-col gap-2">
      <h4 className="mb-0">Download ICA file</h4>
      <p className="m-0">
        This file has one row per assignment ({rows.length} in total), with the
        reviewer&apos;s Person ID and the submission&apos;s Control ID.
      </p>
      {nUnmatched > 0 ? (
        <p className="m-0 text-amber-800">
          <b>Warning:</b> the assignments of {nUnmatched} unmatched reviewer
          {nUnmatched === 1 ? " is" : "s are"} left out of this file, so their assigned submissions will have fewer reviewers.
          If its a few cases, you can go ahead an manually assign other reviewers in ScholarOne.
          You can also exclude these reviewers from the assignments in Step 5, and update the assignments.
        </p>
      ) : null}
      {rows.length === 0 ? (
        <Button disabled className="w-full">
          Nothing to download yet: no matched reviewers
        </Button>
      ) : (
        // CSVDownloader adds the .csv extension itself, and ignores `disabled`
        <CSVDownloader
          type={Type.Button}
          className="flex-auto w-full bg-primary text-primary-foreground p-2 rounded hover:opacity-90 transition-opacity"
          filename={`reviewer_assignments_${projectId}`}
          bom={true}
          config={{ columns: ["Person ID", "Control ID"], newline: "\n" }}
          data={() => rows}
        >
          Download ICA assignments file (CSV)
        </CSVDownloader>
      )}
    </section>
  );
}

function ManualAssignment({
  byReviewer,
  created,
}: {
  byReviewer: Record<string, string>[];
  created: Date | string;
}) {
  const data = useMemo(() => {
    return controlIdsByReviewer(byReviewer)
      .filter((r) => r.ids.length > 0)
      .map((r) => ({
        reviewer: r.reviewer,
        student: r.student,
        control_ids: r.ids.join(", "),
      }))
      .sort((a, b) => a.reviewer.localeCompare(b.reviewer));
  }, [byReviewer]);

  return (
    <details className="border rounded p-4">
      <summary className="cursor-pointer font-bold">
        Fallback: manual assignment in Unit Planner
      </summary>
      <div className="flex flex-col gap-6 mt-4">
        <div>
          <p>
            If you cannot use the upload (or for unmatched reviewers), you can
            assign reviewers manually in ScholarOne. We make this easier by
            providing a table with the control IDs per reviewer (see video
            example).
            <br />
          </p>
          <div className="flex justify-center">
            <UploadAssignmentsVideo />
          </div>
          <ul className="list-disc list-inside mt-3">
            <li>
              Go to <ScholarOneLink created={created} />, open the{" "}
              <b>Review - Unit Planner</b> tab
            </li>
            <li>
              In the <b>People</b> table add the email column. Hover over the{" "}
              <i>First Name</i> column and click on the &#x25BC;. Select{" "}
              <b>Columns</b> &#8594; <b>Email address</b>
            </li>
            <li>Click on the email column to sort it like our table below</li>
            <li>
              Click on a reviewer in the ScholarOne table to select it, and
              then click on <b>Multiple Assignments</b> &#8594;{" "}
              <b> Assign/Unassign by Control ID</b>
            </li>
            <li>
              Copy the control IDs from our table below and paste them into the
              ScholarOne dialog
            </li>
          </ul>
        </div>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead>Reviewer (*student)</TableHead>
              <TableHead>Control IDs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="overflow-hidden w-full">
            {data.map((d) => (
              <TableRow key={d.reviewer}>
                <TableCell
                  className="overflow-hidden font-bold text-ellipsis whitespace-nowrap"
                  title={d.reviewer}
                >
                  {d.student === "Yes" ? "* " : ""}
                  {d.reviewer}
                </TableCell>
                <TableCell className="flex gap-1 justify-between items-center">
                  <span>{d.control_ids}</span>
                  <CopyText text={d.control_ids} />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </details>
  );
}
