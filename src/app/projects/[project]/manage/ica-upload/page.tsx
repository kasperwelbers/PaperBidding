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
import { defaultRegistrationUrl } from "@/lib/registrationUrl";
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
        <p>
          ICA (ScholarOne) can import reviewer assignments from a CSV file. This
          file needs the <b>ICA Person ID</b> of each reviewer, so we first
          need to match the reviewer emails to Person IDs.
        </p>
        <p className="m-0">
          It is possible that not every reviewer has a Person ID in our system
          yet. If so, you will see a warning below. First try updating the
          matching list. If someone is still missing after that, they probably
          do not have an ICA account yet, and you can ask them to make one.
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
          registrationUrl={
            project.registrationInfoUrl ||
            defaultRegistrationUrl(new Date(project.created))
          }
          division={project.division}
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
  registrationUrl,
  division,
  reviewerInfo,
  onUploaded,
}: {
  unmatchedEmails: string[];
  created: Date | string;
  registrationUrl: string;
  division: string;
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
    <section className="border-2 border-amber-400 bg-amber-50 rounded p-4 flex flex-col gap-4">
      <div>
        <h4 className="mb-1 text-amber-900">
          ⚠ {unmatchedEmails.length} assigned reviewer
          {unmatchedEmails.length === 1 ? " has" : "s have"} no ICA Person ID
        </h4>
        <p className="m-0">
          Their assignments will <b>not</b> be in the ICA file. Upload a
          matching list to fix this, or assign them manually (see the fallback
          at the bottom).
        </p>
      </div>

      <div className="bg-white rounded border p-3">
        <div className="flex items-center justify-between mb-1">
          <b>Reviewers without a Person ID</b>
          <div className="flex items-center gap-1 text-xs">
            copy all
            <CopyText text={unmatchedEmails.join("\n")} />
          </div>
        </div>
        <div className="max-h-96 overflow-auto">
          <Table className="text-xs">
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Added via</TableHead>
                <TableHead>Bids</TableHead>
                <TableHead title="First or co-author of a submission in this division">
                  Author
                </TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Institution</TableHead>
                <TableHead title="Found them in ScholarOne? Enter their Person ID here">
                  Person ID
                </TableHead>
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
        <p className="mt-2 mb-0 text-xs opacity-70">
          <b>Reviewer list</b>: in the reviewer CSV uploaded in Step 2, which
          comes from ScholarOne, so they should be in ScholarOne (check the
          email address there). <b>Invitation link</b>: joined via the general
          invitation link and is not in the uploaded reviewer list, so they
          may not have an ICA account. Reviewers without bids were assigned
          based on similarity to their own submissions. If you find someone in
          ScholarOne (e.g., by name, because their email address changed), you
          can enter their Person ID in the last column.
        </p>
      </div>

      <div>
        <Button
          variant={open ? "outline" : "default"}
          className="w-full"
          onClick={() => setOpen(!open)}
        >
          {open ? "▾ Hide" : "▸ First try:"} update the matching list from
          ScholarOne
        </Button>
      </div>

      {open ? (
        <div className="flex flex-col gap-4">
          <div>
            <p className="mb-1">
              Download a list of emails and Person IDs from ScholarOne:
            </p>
            <ol className="list-decimal list-inside leading-6">
              <li>
                Go to <ScholarOneLink created={created} />, open the{" "}
                <b>Admin</b> tab, go to <b>Search</b> and select the{" "}
                <b>People</b> tab
              </li>
              <li>
                Do <b>not</b> filter on division or category. The list should
                be as complete as possible
              </li>
              <li>
                In <b>Select Format</b> select <i>Comma delimited</i>
              </li>
              <li>
                In <b>Select Display Items</b> only add{" "}
                <b className="text-blue-700">PERSON (EMAIL)</b> and{" "}
                <b className="text-blue-700">PERSON (ID)</b>
              </li>
              <li>
                Click <b>Run</b> at the bottom, and upload the file below
              </li>
            </ol>
            <p className="mt-2 italic">
              This list is shared across all divisions, so other divisions may
              already have filled it in for most people. If a reviewer is still
              unmatched after uploading, they may not have an ICA account yet.
            </p>
          </div>

          <div className="bg-white rounded p-3">
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
        </div>
      ) : null}

      <StillMissing
        unmatchedEmails={unmatchedEmails}
        registrationUrl={registrationUrl}
        division={division}
      />
    </section>
  );
}

/** What to do with reviewers that are not in the matching list at all. This
 *  happens when someone bid (e.g., via the general invitation link) but never
 *  made an ICA account */
function StillMissing({
  unmatchedEmails,
  registrationUrl,
  division,
}: {
  unmatchedEmails: string[];
  registrationUrl: string;
  division: string;
}) {
  const subject = `Please create an ICA account (${division} reviewing)`;
  const body = `Dear reviewer,

Thank you for reviewing for the ${division} division. To assign submissions to you, you need an account in the ICA submission system (ScholarOne), but we could not find one for this email address.

Could you please create an account (or add this email address to your existing account) here:
${registrationUrl}

Please let us know once you have done this, so that we can assign the submissions to you.

Kind regards,`;
  const mailto =
    `mailto:?bcc=${encodeURIComponent(unmatchedEmails.join(","))}` +
    `&subject=${encodeURIComponent(subject)}` +
    `&body=${encodeURIComponent(body)}`;

  return (
    <div className="flex flex-col gap-2 border-t border-amber-300 pt-4">
      <h5 className="mb-0">Still missing after updating the matching list?</h5>
      <p className="m-0">
        Check the <i>Added via</i> column above:
      </p>
      <ul className="list-disc list-inside leading-6 m-0">
        <li>
          <b>Reviewer list</b>: they came from a ScholarOne export, so they
          should be in ScholarOne. Search for their email address on this
          year&apos;s ScholarOne site. Their account may use a different main
          email address now, or the reviewer list was an older export.
        </li>
        <li>
          <b>Invitation link</b>: they joined via the general invitation link,
          and probably never made an ICA account (or use a different email
          address there).
        </li>
      </ul>
      <p className="m-0">If you cannot find them in ScholarOne:</p>
      <ol className="list-decimal list-inside leading-6 m-0">
        <li>
          Ask them to create an ICA account with this email address, at{" "}
          <a
            href={registrationUrl}
            target="_blank"
            rel="noreferrer"
            className="underline text-blue-900 break-all"
          >
            {registrationUrl}
          </a>
          .{" "}
          <a href={mailto} className="underline text-blue-900 font-bold">
            Open an email to these reviewers
          </a>{" "}
          <span className="opacity-70">
            (they are added as BCC; or use the copy all button above)
          </span>
        </li>
        <li>
          Once they have registered, download the matching list from ScholarOne
          again and upload it here
        </li>
      </ol>
      <p className="m-0 italic">
        If someone cannot or will not register, you can assign their
        submissions to other reviewers by hand in ScholarOne (see the fallback
        at the bottom). You could also exclude them in Step 5 and update the
        assignments, but note that this can change the assignments of other
        reviewers as well, so only do this before uploading anything to ICA.
      </p>
    </div>
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
  const dash = loading ? "…" : "-";
  let addedVia = loading ? "…" : "not in reviewer list";
  if (reviewer)
    addedVia = reviewer.selfRegistered ? "invitation link" : "reviewer list";

  return (
    <TableRow>
      <TableCell className="break-all font-medium">{email}</TableCell>
      <TableCell
        className={`whitespace-nowrap ${reviewer?.selfRegistered ? "text-amber-800 font-bold" : ""}`}
      >
        {addedVia}
      </TableCell>
      <TableCell>{reviewer ? reviewer.manualBiddings || "none" : dash}</TableCell>
      <TableCell>{reviewer ? (reviewer.author ? "yes" : "no") : dash}</TableCell>
      <TableCell>{reviewer ? (reviewer.student ? "yes" : "no") : dash}</TableCell>
      <TableCell>{reviewer ? reviewer.institution || "-" : dash}</TableCell>
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
          {nUnmatched === 1 ? " is" : "s are"} left out of this file. You will
          need to assign them manually (see below).
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
            <span className="text-xs">
              We do have a browser automation script in Python: email
              k.welbers@vu.nl if you want it
            </span>
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
