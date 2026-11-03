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
  BySubmission,
  ByReviewer,
} from "@/types";
import { use, useEffect, useMemo, useState } from "react";
import { useCSVDownloader } from "react-papaparse";
import makeAssignments from "./makeAssignments";
import { Dot } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import Link from "next/link";
import { CopyText } from "./shared";

export default function BiddingPage(props: {
  params: Promise<{ project: string }>;
}) {
  const params = use(props.params);
  const projectId = Number(params.project);

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
  } = useProject(projectId);

  const reviewers = useAllData<GetReviewer>({
    projectId: projectId,
    what: "reviewers",
    limit: 500,
  });

  useEffect(() => {
    if (!reviewers.data) {
      setCanReview({});
      return;
    }
    const canReview: Record<string, boolean> = {};
    for (let reviewer of reviewers.data) {
      canReview[reviewer.email] = reviewer.canReview;
    }
    setCanReview(canReview);
  }, [reviewers.data]);

  const submissions = useAllData<GetMetaSubmission>({
    projectId: projectId,
    what: "submissions",
    meta: true,
    limit: 500,
  });
  const {
    data: assignments,
    isLoading: assignmentsLoading,
    error: assignmentsError,
    mutate: mutateAssignments,
  } = useAssignments(projectId);

  const { trigger: uploadAssignments } = useUploadAssignments(projectId);

  const whoCount = useMemo(() => {
    let nAuthors = 0;
    let nAuthorsOrBidders = 0;
    let nEveryone = 0;
    for (let r of reviewers.data || []) {
      nEveryone++;
      if (r.author) nAuthors++;
      if (r.author || r.manualBiddings > 0) nAuthorsOrBidders++;
    }
    return { nAuthors, nAuthorsOrBidders, nEveryone };
  }, [reviewers.data]);

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

  if (reviewers.isLoading || submissions.isLoading || projectLoading)
    return <Loading />;
  if (!project) return <Error msg={projectError?.message || ""} />;
  if (reviewers.error) return <Error msg={reviewers.error.message} />;
  if (submissions.error) return <Error msg={submissions.error.message} />;

  function updateAssignments() {
    if (!reviewers.data || !submissions.data) return;
    const data = makeAssignments(
      reviewers.data,
      canReview,
      submissions.data,
      perSubmission,
      maxStudentReviewers,
      includeWho,
      autoPenalty,
    );
    setData(data);
    // refetch, so that the manage page sees the new assignments (Step 5 done, Step 6 enabled)
    uploadAssignments(data).then(() => mutateAssignments());
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
        projectId={projectId}
        canReview={canReview}
        setCanReview={setCanReview}
      />
      <ReviewersBySubmission
        bySubmission={data?.bySubmission}
        projectId={projectId}
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
    <div className="bg-primary/10 border rounded p-3 lg:p-9 text-sm  mt-3 flex flex-col gap-9">
      <div className="flex flex-col gap-3">
        <h3 className="text-center mb-0">Next: upload to ICA</h3>
        <p className="text-sm">
          When you are happy with the assignments, go to{" "}
          <Link
            href={`/projects/${projectId}/manage/ica-upload`}
            className="underline text-blue-900 font-bold"
          >
            Step 6. Upload to ICA
          </Link>{" "}
          to download the file for uploading the assignments to ScholarOne.
        </p>
        <p className="italic text-sm">
          <b>Keep a backup.</b> Once you have uploaded the assignments to ICA,
          you do not want them to change. Download a backup of the current
          assignments, so you always have a record of what was uploaded.
        </p>
        <CSVDownloader
          type={Type.Button}
          className="flex-auto w-full bg-secondary text-primary p-1 rounded hover:text-secondary hover:bg-primary transition-colors "
          filename={`reviewer_biddings_${projectId}`}
          bom={true}
          disabled={!data}
          data={() => data}
        >
          Download backup of current assignments (CSV)
        </CSVDownloader>
      </div>
      <div className="flex flex-col gap-6 w-full">
        <p className='text-sm'>
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
                      className={d.canReview ? "text-sm" : "opacity-50"}
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
