"use client";

import { Error } from "@/components/ui/error";
import { Loading } from "@/components/ui/loading";
import { useAllData, useProject, useReviewer } from "@/hooks/api";
import { computeRelevantSubmissions } from "@/lib/computeRelevantSubmissions";
import { GetSubmission } from "@/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaArrowRight, FaQuestionCircle } from "react-icons/fa";
import { GiVote } from "react-icons/gi";
import SubmissionItem from "./SubmissionItem";
import useSelection from "./useSelection";
import CurrentSelection from "./CurrentSelection";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export default function Reviewer({
  params,
}: {
  params: { project: number; reviewer: number; secret: number };
}) {
  const token = params.reviewer + "/" + params.secret;

  const {
    data: submissions,
    isLoading,
    error,
  } = useAllData<GetSubmission>(params.project, "submissions", token);
  const {
    data: reviewer,
    isLoading: isLoadingReviewer,
    error: errorReviewer,
  } = useReviewer(params.project, params.reviewer, token);

  const { selected, setSelected, selectionStatus } = useSelection(
    params.project,
    params.reviewer,
    token,
  );

  const [showSelected, setShowSelected] = useState(false);
  const [page, setPage] = useState(1);
  const { data: project } = useProject(params.project);
  const projectName = project?.name || "";
  const popupRef = useRef<HTMLDivElement>(null);

  const relevantSubmissions = useMemo(() => {
    return computeRelevantSubmissions(submissions, reviewer);
  }, [submissions, reviewer]);

  useEffect(() => {
    function closePopup(e: MouseEvent) {
      if (popupRef.current?.contains(e.target as Node)) return;
      setShowSelected(false);
    }
    window.addEventListener("mousedown", closePopup);
    return () => window.removeEventListener("mousedown", closePopup);
  }, [popupRef]);

  if (isLoading) return <Loading msg="Loading Submissions" />;
  if (error) return <Error msg={error.message} />;
  if (isLoadingReviewer) return <Loading msg="Loading Reviewer" />;
  if (errorReviewer) return <Error msg={errorReviewer.message} />;
  if (!relevantSubmissions) return <Loading msg="Ranking Submissions" />;
  if (!submissions) return <Loading msg="Loading Submissions" />;
  if (selectionStatus === "loading") return <Loading msg="Loading Selection" />;
  if (selectionStatus === "error")
    return <Error msg="Error Loading Selection. Please reload page" />;

  const nPages = Math.ceil(relevantSubmissions?.length / 10 || 0);
  const pageData = relevantSubmissions?.slice((page - 1) * 10, page * 10);
  function nextPage() {
    setPage(Math.min(nPages, page + 1));
  }
  function prevPage() {
    setPage(Math.max(1, page - 1));
  }

  const pagination = (
    <div
      className={`Pagination flex justify-end items-center p-2 pr-5 pt-0 md:pt-2 gap-1 md:gap-3 `}
    >
      <FaArrowLeft
        className={`w-6 h-6  ${
          page === 1
            ? "cursor-default text-gray-300"
            : "cursor-pointer text-blue-500 hover:text-blue-700"
        }`}
        onClick={prevPage}
      />
      <span className="font-bold min-w-[7rem] text-center select-none">
        Page {page} / {nPages}
      </span>
      <FaArrowRight
        className={`w-6 h-6  ${
          page === nPages
            ? "cursor-default text-gray-300"
            : "cursor-pointer text-blue-500 hover:text-blue-700"
        }`}
        onClick={nextPage}
      />
    </div>
  );

  return (
    <div className="relative flex flex-col h-screen">
      <header className="flex  z-20 px-1 sticky top-0 w-full justify-center bg-foreground  text-white">
        <div className="flex flex-col md:flex-row w-full justify-between">
          <div className="w-full flex items-center p-2 gap-x-3 justify-between ">
            <VoteBox
              selected={selected}
              setSelected={setSelected}
              projectId={Number(params.project)}
              reviewerId={Number(params.reviewer)}
              token={token}
              submissions={submissions}
            />
            <div className="italic text-sm max-w-[60%] overflow-hidden text-ellipsis whitespace-nowrap">
              {reviewer?.email}
            </div>
          </div>
        </div>
      </header>
      <div className="h-full flex flex-col  gap-3 md:gap-5 px-3 md:px-3 overflow-auto">
        <div
          className={`py-3 flex justify-center h-full max-h-full ${
            showSelected ? "blur-[2px] opacity-50 pointer-events-none" : ""
          }`}
        >
          <div className="relative flex flex-col w-full">
            <div className="fixed left-3">
              <Instruction />
            </div>
            <div className="flex flex-col">
              <div className="flex justify-center py-6">{pagination}</div>
              <div className="flex flex-col mx-auto">
                {pageData?.map((submission) => {
                  return (
                    <SubmissionItem
                      key={submission.id}
                      projectId={Number(params.project)}
                      reviewerId={Number(params.reviewer)}
                      token={token}
                      submission={submission}
                      selected={selected}
                      setSelected={setSelected}
                    />
                  );
                })}
              </div>
              <div className="flex justify-center mt-auto py-6">
                {pagination}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VoteBox({
  selected,
  setSelected,
  projectId,
  reviewerId,
  token,
  submissions,
}: {
  selected: number[];
  setSelected: (selected: number[]) => void;
  projectId: number;
  reviewerId: number;
  token: string;
  submissions: GetSubmission[];
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" is="button">
          <div className={`flex items-center text-lg gap-6`}>
            <GiVote size={36} />
            {selected.length} {selected.length === 1 ? "bid" : "bids"}
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[700px] max-w-[95vw] max-h-[90vh]">
        <DialogHeader className="text-left">
          <DialogTitle>Your bids</DialogTitle>
          <DialogDescription>
            There are your bids. You can change the order or delete them. You
            can make as many bids as you want (10 is a good number).{"  "}
            <b>When you are done</b> simply close the application.
          </DialogDescription>
        </DialogHeader>

        <CurrentSelection
          selected={selected}
          setSelected={setSelected}
          projectId={projectId}
          reviewerId={reviewerId}
          token={token}
          submissions={submissions}
        />
      </DialogContent>
    </Dialog>
  );
}

function Instruction() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" className="pl-5">
          <FaQuestionCircle size={30} />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-max">
        <DialogHeader>
          <DialogTitle className="">How does paper bidding work?</DialogTitle>
        </DialogHeader>
        <DialogDescription className="h-0 hidden"></DialogDescription>
        <div className="prose lg:prose-xl">
          <p>
            Simply <b>check the box for any abstracts you like</b>. Your
            selection will be used to assign you as a reviewer. The number of
            bids does not affect the number of reviews you will be asked to do.
            So bid on as many as you like. <b>Around 10</b> is a good number.
          </p>
          <p>
            The submissions you see are{" "}
            <b>ordered based on similarity to your own submissions</b>. If you
            do not bid, this order is used to assign submissions to you. Bidding
            will override this order, and give you priority on the selected
            submissions.
          </p>

          <p>
            Biddings are immediately saved, so you can{" "}
            <b>just leave when you are done</b>. You can also view and change
            your selection via the voting box in the top-left corner. Here you
            can also change the order, which affects the ranking.{" "}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
