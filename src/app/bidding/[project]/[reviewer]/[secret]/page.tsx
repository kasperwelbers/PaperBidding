"use client";

import { Error } from "@/components/ui/error";
import { Loading } from "@/components/ui/loading";
import { useAllData, useProject, useReviewer } from "@/hooks/api";
import { computeRelevantSubmissions } from "@/lib/computeRelevantSubmissions";
import { GetSubmission } from "@/types";
import { use, useEffect, useMemo, useRef, useState } from "react";
import { FaQuestionCircle } from "react-icons/fa";
import { GiVote } from "react-icons/gi";
import SubmissionItem, { SubmissionItemTitle } from "./SubmissionItem";
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
import { SkipBack, SkipForward } from "lucide-react";
import { Input } from "@/components/ui/input";

export default function Reviewer(props: {
  params: Promise<{ project: string; reviewer: string; secret: string }>;
}) {
  const params = use(props.params);
  const projectId = Number(params.project);
  const reviewerId = Number(params.reviewer);
  const secret = params.secret;

  const token = reviewerId + "/" + secret;
  const [search, setSearch] = useState("");
  const [filteredSubmissions, setFilteredSubmissions] = useState<
    GetSubmission[]
  >([]);

  const {
    data: submissions,
    isLoading,
    error,
  } = useAllData<GetSubmission>({
    projectId: projectId,
    what: "submissions",
    token,
    limit: 750, // Don't set too high for vercel body limit
  });
  const {
    data: reviewer,
    isLoading: isLoadingReviewer,
    error: errorReviewer,
  } = useReviewer(projectId, reviewerId, token);

  const { selected, setSelected, selectionStatus } = useSelection(
    projectId,
    reviewerId,
    token,
  );

  const [showSelected, setShowSelected] = useState(false);
  const [page, setPage] = useState(1);
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

  useEffect(() => {
    function filterSubmissions() {
      if (!search) {
        setFilteredSubmissions(relevantSubmissions || []);
      } else {
        setFilteredSubmissions(
          (relevantSubmissions || []).filter((s) => {
            return s.title.toLowerCase().includes(search.toLowerCase());
          }),
        );
      }
    }
    const delayDebounceFn = setTimeout(() => {
      filterSubmissions();
      setPage(1);
    }, 300);

    return () => clearTimeout(delayDebounceFn);
  }, [search, relevantSubmissions]);

  if (isLoading) return <Loading msg="Loading Submissions" />;
  if (error) return <Error msg={error.message} />;
  if (isLoadingReviewer) return <Loading msg="Loading Reviewer" />;
  if (errorReviewer) return <Error msg={errorReviewer.message} />;
  if (!relevantSubmissions) return <Loading msg="Ranking Submissions" />;
  if (!submissions) return <Loading msg="Loading Submissions" />;
  if (selectionStatus === "loading") return <Loading msg="Loading Selection" />;
  if (selectionStatus === "error")
    return <Error msg="Error Loading Selection. Please reload page" />;

  const nPages = Math.ceil(filteredSubmissions?.length / 10 || 0);
  const pageData = filteredSubmissions?.slice((page - 1) * 10, page * 10);
  function nextPage() {
    setPage(Math.min(nPages, page + 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function prevPage() {
    setPage(Math.max(1, page - 1));
  }

  const pagination = (
    <div
      className={`Pagination flex justify-end items-center  gap-1 md:gap-3 `}
    >
      <SkipBack
        className={`w-10 h-10 py-2 ${
          page === 1
            ? "cursor-default text-gray-300"
            : "cursor-pointer text-blue-500 hover:text-blue-700"
        }`}
        onClick={prevPage}
      />
      <span className="font-bold min-w-[3rem] text-center select-none">
        {page} / {nPages}
      </span>
      <SkipForward
        className={`w-10 h-10 py-2 ${
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
              projectId={Number(projectId)}
              reviewerId={Number(reviewerId)}
              token={token}
              submissions={submissions}
            />
            <div className="italic text-sm max-w-[60%] overflow-hidden text-ellipsis whitespace-nowrap">
              {reviewer?.email}
            </div>
          </div>
        </div>
      </header>
      <div className="h-full flex flex-col  gap-3 md:gap-5 px-3 md:px-3 ">
        <div
          className={`py-3 flex justify-center h-full max-h-full ${
            showSelected ? "blur-[2px] opacity-50 pointer-events-none" : ""
          }`}
        >
          <div className="relative flex flex-col w-full">
            <div className="absolute right-0">
              <Instruction />
            </div>
            <div className="flex flex-col">
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="w-full md:w-max mr-auto text-sm bg-primary/80 text-background py-2 px-3 rounded flex mb-3">
                  <ul className="list-disc pl-4 m-0 ">
                    <li>Place around 5 bids or more</li>
                    <li>Rank matters. Rank 1 is your first choice</li>
                    <li>Bids are saved directly. No need to submit</li>
                    <li>Click the title to see the abstract</li>
                  </ul>
                </div>
                <div className="flex items-center justify-end mt-auto gap-3">
                  {/*<Search className="h-5 w-5 text-foreground/50" />*/}
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search titles"
                    className="w-44 h-8"
                  />
                  {pagination}
                </div>
              </div>
              <div className="flex flex-col mx-auto w-[700px] max-w-[90vw]">
                <div className="flex flex-col gap-2 mt-6">
                  <SubmissionItemTitle />
                  {pageData?.map((submission) => {
                    return (
                      <SubmissionItem
                        key={submission.id}
                        projectId={Number(projectId)}
                        reviewerId={Number(reviewerId)}
                        token={token}
                        submission={submission}
                        selected={selected}
                        setSelected={setSelected}
                      />
                    );
                  })}
                </div>
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
            can make as many bids as you want (5 is a good number).{"  "}
            <b>When you are done</b> simply close the application.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col mt-3 gap-2">
          <SubmissionItemTitle />
          <CurrentSelection
            selected={selected}
            setSelected={setSelected}
            projectId={projectId}
            reviewerId={reviewerId}
            token={token}
            submissions={submissions}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Instruction() {
  return (
    <Dialog defaultOpen>
      <DialogTrigger asChild>
        <Button variant="ghost" className="pl-5">
          <FaQuestionCircle className="bg-white rounded-full p-[1px] size-6 md:size-8" />
        </Button>
      </DialogTrigger>
      <DialogContent className="w-max ">
        <DialogHeader>
          <DialogTitle className="">How does paper bidding work?</DialogTitle>
        </DialogHeader>
        <DialogDescription className="h-0 hidden"></DialogDescription>
        <div className="prose">
          <p>
            Simply <b>check the box for any abstracts you like</b>. Your
            selection will be used to assign you as a reviewer. The number of
            bids does not affect the number of reviews you will be asked to do.
            So bid on as many as you like. <b>Around 5</b> is usually enough for
            good matches, but feel free to go wild.
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
