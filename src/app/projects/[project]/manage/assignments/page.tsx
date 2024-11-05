"use client";

import { Button } from "@/components/ui/button";
import { Error } from "@/components/ui/error";
import { Loading } from "@/components/ui/loading";
import {
  useAllData,
  useAssignments,
  useProject,
  useUploadAssignments,
} from "@/hooks/api";
import {
  GetReviewer,
  GetMetaSubmission,
  Bidding,
  BySubmission,
  ByReviewer,
} from "@/types";
import { useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaCopy, FaEye, FaVideo } from "react-icons/fa";
import { useCSVDownloader } from "react-papaparse";
import makeAssignments from "./makeAssignments";
import Link from "next/link";
import { Dot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

export default function BiddingPage({
  params,
}: {
  params: { project: number };
}) {
  const [data, setData] = useState<{
    byReviewer: ByReviewer[];
    bySubmission: BySubmission[];
  }>();
  const [perSubmission, setPerSubmission] = useState(3);
  const [autoPenalty, setAutoPenalty] = useState(5);
  const [maxStudentReviewers, setMaxStudentReviewers] = useState(1);
  const [includeWho, setIncludeWho] = useState<
    "all" | "authors" | "authors or bidders"
  >("all");
  const [canReview, setCanReview] = useState<Record<string, boolean>>({});

  const {
    data: project,
    isLoading: projectLoading,
    error: projectError,
  } = useProject(params.project);
  const {
    data: reviewers,
    isLoading: reviewersLoading,
    error: reviewersError,
    mutate: mutateReviewers,
  } = useAllData<GetReviewer>(
    params.project,
    "reviewers",
    undefined,
    undefined,
    250,
  );

  useEffect(() => {
    if (!reviewers) {
      setCanReview({});
      return;
    }
    const canReview: Record<string, boolean> = {};
    for (let reviewer of reviewers) {
      canReview[reviewer.email] = reviewer.canReview;
    }
    setCanReview(canReview);
  }, [reviewers]);

  const {
    data: submissions,
    isLoading: submissionsLoading,
    error: submissionsError,
  } = useAllData<GetMetaSubmission>(
    params.project,
    "submissions",
    undefined,
    true,
  );
  const {
    data: assignments,
    isLoading: assignmentsLoading,
    error: assignmentsError,
  } = useAssignments(params.project);

  const { trigger: uploadAssignments } = useUploadAssignments(params.project);

  const whoCount = useMemo(() => {
    let nAuthors = 0;
    let nAuthorsOrBidders = 0;
    let nEveryone = 0;
    for (let r of reviewers || []) {
      nEveryone++;
      if (r.author) nAuthors++;
      if (r.author || r.manualBiddings > 0) nAuthorsOrBidders++;
    }
    return { nAuthors, nAuthorsOrBidders, nEveryone };
  }, [reviewers]);

  useEffect(() => {
    if (assignments) {
      setData({
        byReviewer: assignments.byReviewer,
        bySubmission: assignments.bySubmission,
      });
      setPerSubmission(assignments.settings.reviewersPerSubmission);
      setAutoPenalty(assignments.settings.autoPenalty);
      setMaxStudentReviewers(assignments.settings.maxStudentReviewers);
      setIncludeWho(assignments.settings.includeWho);
    }
  }, [assignments]);

  if (reviewersLoading || submissionsLoading || projectLoading)
    return <Loading />;
  if (!project) return <Error msg={projectError?.message || ""} />;
  if (reviewersError) return <Error msg={reviewersError.message} />;
  if (submissionsError) return <Error msg={submissionsError.message} />;

  function updateAssignments() {
    if (!reviewers || !submissions) return;
    const data = makeAssignments(
      reviewers,
      canReview,
      submissions,
      perSubmission,
      maxStudentReviewers,
      includeWho,
      autoPenalty,
    );
    uploadAssignments(data);
    setData(data);
  }

  return (
    <div className="grid max-w-7xl gap-y-6 mx-auto grid-cols-1 lg:grid-cols-2 items-center lg:items-start justify-center mt-6 w-full">
      <div className="col-span-1 lg:col-span-2 flex flex-col gap-3  mb-6 ml-auto px-5">
        <div className="flex flex-col items-center gap-3 lg:flex-row lg:items-start">
          <div className="flex gap-3 justify-between mt-2 pr-3">
            <Label>Assign who</Label>
            <RadioGroup
              name="includeWho"
              value={includeWho}
              onValueChange={(value) => setIncludeWho(value as any)}
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="all" id="r1" />
                <Label htmlFor="r1">Everyone ({whoCount.nEveryone})</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="authors" id="r2" />
                <Label htmlFor="r2">Only authors ({whoCount.nAuthors})</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="authors or bidders" id="r3" />
                <Label htmlFor="r3">
                  Authors or bidders ({whoCount.nAuthorsOrBidders})
                </Label>
              </div>
            </RadioGroup>
          </div>
          <div className="grid grid-cols-[1fr,6rem] gap-[2px] items-center">
            <Label htmlFor="perSubmission">Reviewers per submission</Label>

            <Input
              name="perSubmission"
              type="number"
              className="w-16 h-6"
              value={perSubmission}
              min={1}
              max={10}
              onChange={(e) => setPerSubmission(parseInt(e.target.value))}
            />
            <Label htmlFor="autoPenalty">no-bid penalty</Label>
            <Input
              name="autoPenalty"
              type="number"
              className="w-16 h-6"
              value={autoPenalty}
              min={0}
              max={100}
              onChange={(e) => setAutoPenalty(parseInt(e.target.value))}
            />
            <Label htmlFor="maxStudent">Max student reviewers</Label>
            <Input
              name="maxStudent"
              type="number"
              className="w-16 h-6"
              value={maxStudentReviewers}
              min={0}
              max={100}
              onChange={(e) => setMaxStudentReviewers(parseInt(e.target.value))}
            />
          </div>
          <div className="grid grid-cols-1 gap-1 ">
            <Button
              onClick={(e) => updateAssignments()}
              disabled={assignmentsLoading}
            >
              {data ? "Update" : "Compute"} assignments
            </Button>
            <div className="h-6 mt-2">
              {assignments
                ? `Last updated: ${new Date(assignments.lastUpdate).toLocaleString()}`
                : null}
            </div>
          </div>
        </div>
      </div>
      <SubmissionsByReviewer
        byReviewer={data?.byReviewer}
        projectId={params.project}
        canReview={canReview}
        setCanReview={setCanReview}
      />
      <ReviewersBySubmission
        bySubmission={data?.bySubmission}
        projectId={params.project}
      />
    </div>
  );
}

function ReviewersBySubmission({
  bySubmission,
  projectId,
}: {
  bySubmission: BySubmission[] | undefined;
  projectId: number;
}) {
  const { CSVDownloader, Type } = useCSVDownloader();

  return (
    <div className="p-3 lg:p-9  mt-3 flex flex-col gap-3">
      {/* <CSVDownloader
        type={Type.Button}
        className="flex-auto w-full bg-secondary text-primary p-1 rounded hover:text-secondary hover:bg-primary transition-colors "
        filename={`submission_biddings_${projectId}.csv`}
        bom={true}
        disabled={!bySubmission}
        data={() => bySubmission}
      >
        Download CSV
      </CSVDownloader> */}
      <h3 className="text-center">How do the assignments work?</h3>
      <p className="max-w whitespace-normal">
        Each reviewer has a <b>ranking</b> for most suitable submissions, based
        on the similarity to their own work and/or the paper biddings. For
        similarity based rankings, we add the <b>no-bid penalty</b> to give
        priority to reviewers that took the effort to bid. So the higher this
        penalty, the more you prioritize the biddings over the automatic
        similarity ranking.
      </p>
      <p>
        For each assignment we report the reviewer rank, where 1 indicates that
        this was the best match for the reviewer, 2 the second best, An *
        indicates that the rank is based on similarity (and not on bidding), so
        for the matching the no-bid penalty was applied.
      </p>
      {bySubmission ? (
        <div className="flex flex-col gap-6 mt-6">
          {bySubmission.map((d) => {
            return (
              <div
                key={d.submission_id}
                className="flex flex-col gap-3 border-b pb-3"
              >
                <div>
                  <div className="flex gap-3 ">
                    <div className="px-3 py-1 h-min  bg-primary text-primary-foreground rounded">
                      {d.submission_id}
                    </div>
                    <div className="">
                      <div className="font-bold text-sm min-w-0 whitespace-break-spaces">
                        {d.title}
                      </div>
                      <div className=" mt-1 italic text-sm min-w-0 whitespace-break-spaces">
                        {d.authors}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-1 ml-6">
                  {Object.keys(d).map((k) => {
                    if (!k.includes("reviewer_")) return null;
                    const rank = d[k.replace("reviewer_", "reviewer.rank_")];
                    const student =
                      d[k.replace("reviewer_", "reviewer.student_")];
                    if (!d[k]) return null;
                    return (
                      <div key={k} className="flex">
                        <Dot />
                        {d[k]}
                        <div className="opacity-60 ml-auto flex gap-3">
                          {rank}
                          {student === "yes" ? (
                            <div className="opacity-60 ml-auto">student</div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function SubmissionsByReviewer({
  byReviewer,
  projectId,
  canReview,
  setCanReview,
}: {
  byReviewer: ByReviewer[] | undefined;
  projectId: number;
  canReview: Record<string, boolean>;
  setCanReview: (value: Record<string, boolean>) => void;
}) {
  const { CSVDownloader, Type } = useCSVDownloader();
  const data = useMemo(() => {
    if (!byReviewer) return null;

    const data = byReviewer.map((r) => {
      const control_ids: string[] = [];

      for (const [col, value] of Object.entries(r)) {
        if (col.startsWith("submission_") && value) {
          control_ids.push(value);
        }
      }
      return {
        reviewer: r.reviewer,
        student: r.student,
        canReview: r.canReview === "Yes",
        control_ids: control_ids.join(", "),
      };
    });
    return data.sort((a, b) => a.reviewer.localeCompare(b.reviewer));
  }, [byReviewer]);

  async function updateReviewer(reviewer: string, reviewerCanReview: boolean) {
    // TODO, make this nicer. Bit of an ad hoc hack
    fetch(`/api/projects/${projectId}/data/reviewers`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: reviewer, canReview: reviewerCanReview }),
    }).then((res) => {
      if (res.ok) {
        setCanReview({ ...canReview, [reviewer]: reviewerCanReview });
      }
    });
  }

  if (!data) return null;

  return (
    <div className="bg-primary/10 border rounded p-3 lg:p-9  mt-3 flex flex-col gap-9">
      <h3 className="text-center">Uploading to ScholarOne</h3>
      <div>
        <p>
          It is (sadly) not yet possible to upload the reviewer assignments
          directly to ScholarOne. You need to assign the submission IDs per
          reviewer. To make this as easy as possible, the following steps let
          you sort the reviewers in the same way, and directly copy-paste the
          submission IDs
        </p>
        <div className="flex justify-center">
          <UploadAssignmentsVideo />
        </div>
        <ul className="list-disc list-inside mt-3">
          <li>
            Go to{" "}
            <a
              target="_blank"
              rel="noreferrer"
              href="https://ica2025.abstractcentral.com"
              className="underline text-blue-900"
            >
              ScholarOne,
            </a>{" "}
            open the <b>Review - Unit Planner</b> tab
          </li>
          <li>
            In the <b>People</b> table add the email column. Hover over the{" "}
            <i>First Name</i> column and click on the &#x25BC;. Select{" "}
            <b>Columns</b> &#8594; <b>Email address</b>
          </li>
          <li>Click on the email column to sort it like our table below</li>
          <li>
            Click on a reviewer in the ScholarOne table to select it, and then
            click on <b>Multiple Assignments</b> &#8594;{" "}
            <b> Assign/Unassign by Control ID</b>
          </li>
          <li>
            Copy the control IDs from our table below and paste them into the
            ScholarOne dialog
          </li>
        </ul>
      </div>
      <div>
        <p className="mt-3 italic">
          <b>Be carefull</b> that once you start assigning in ScholarOne, you do
          not want the assignments to change! Therefore, before you start, make
          sure to download the CSV file with the current assignments.
        </p>
        <CSVDownloader
          type={Type.Button}
          className="flex-auto w-full bg-secondary text-primary p-1 rounded hover:text-secondary hover:bg-primary transition-colors "
          filename={`reviewer_biddings_${projectId}.csv`}
          bom={true}
          disabled={!data}
          data={() => data}
        >
          Download CSV
        </CSVDownloader>
      </div>
      <div className="flex flex-col gap-6 w-full">
        <p>
          <b>Exclude reviewers.</b> If you want to exclude specific reviewers,
          you can uncheck their box. Then when you update the assignments, these
          reviewers will not be assigned
        </p>
        <Table className="table-fixed">
          <TableHeader>
            <TableRow>
              <TableHead className="w-6"></TableHead>
              <TableHead>Reviewer (*student)</TableHead>
              <TableHead>Control IDs</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="overflow-hidden w-full">
            {data.map((d) => {
              return (
                <TableRow key={d.reviewer} className="">
                  <TableCell>
                    <Input
                      type="checkbox"
                      className="w-4 h-6 accent-primary"
                      checked={canReview[d.reviewer] || false}
                      onChange={(e) => {
                        updateReviewer(d.reviewer, e.target.checked);
                      }}
                    />
                  </TableCell>
                  <TableCell className="overflow-hidden font-bold max-w-[50%] text-ellipsis whitespace-nowrap">
                    {d.student === "Yes" ? " *" : ""}
                    <span
                      title={d.reviewer}
                      className={d.canReview ? "" : "opacity-50"}
                    >
                      {" "}
                      {d.reviewer}
                    </span>
                  </TableCell>
                  <TableCell className="flex gap-1 justify-between items-center">
                    <span>{d.control_ids}</span>
                    <CopyText text={d.control_ids} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      size="icon"
      variant="ghost"
      className="relative"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 500);
      }}
    >
      <FaCopy />
      {copied ? (
        <div className="absolute -bottom-4 right-0 animate-slide-in">
          Copied!
        </div>
      ) : null}
    </Button>
  );
}

function UploadAssignmentsVideo() {
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
        <div className="flex flex-col items-center min-w-[400px] pt-6">
          <video id="instruction-video" autoPlay muted controls>
            <source src="/assign_reviewers.webm" type="video/webm" />
          </video>
        </div>
      </DialogContent>
    </Dialog>
  );
}
