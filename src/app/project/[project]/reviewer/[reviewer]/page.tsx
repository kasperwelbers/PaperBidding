'use client';

import { Error } from '@/components/ui/error';
import { Loading } from '@/components/ui/loading';
import { Submission } from '@/drizzle/schema';
import { useAbstract, useAllData, useProject, useReviewer } from '@/hooks/api';
import { computeRelevantSubmissions } from '@/lib/computeRelevantSubmissions';
import { GetSubmission } from '@/types';
import { SetStateAction, useEffect, useMemo, useRef, useState, Dispatch } from 'react';
import {
  FaArrowLeft,
  FaArrowRight,
  FaChevronDown,
  FaChevronRight,
  FaClock,
  FaQuestion,
  FaQuestionCircle
} from 'react-icons/fa';
import { GiVote } from 'react-icons/gi';

export default function Reviewer({ params }: { params: { project: number; reviewer: number } }) {
  const {
    data: submissions,
    isLoading,
    error
  } = useAllData<GetSubmission>(params.project, 'submissions');
  const [selected, setSelected] = useState(new Set<number>());
  const [focusSelected, setFocusSelected] = useState<number>();
  const [page, setPage] = useState(1);
  const { data: project } = useProject(params.project);
  const {
    data: reviewer,
    isLoading: isLoadingReviewer,
    error: errorReviewer
  } = useReviewer(params.project, params.reviewer);
  const popupRef = useRef<HTMLDivElement>(null);

  const relevantSubmissions = useMemo(() => {
    return computeRelevantSubmissions(submissions, reviewer);
  }, [submissions, reviewer]);

  useEffect(() => {
    setFocusSelected(undefined);

    function closePopup(e: MouseEvent) {
      if (popupRef.current?.contains(e.target as Node)) return;
      setFocusSelected(undefined);
    }
    window.addEventListener('click', closePopup);
    return () => window.removeEventListener('click', closePopup);
  }, [selected, popupRef]);

  if (isLoading) return <Loading msg="Loading Project" />;
  if (error) return <Error msg={error.message} />;
  if (isLoadingReviewer) return <Loading msg="Loading Reviewer" />;
  if (errorReviewer) return <Error msg={errorReviewer.message} />;
  if (!relevantSubmissions) return <Loading msg="Ranking Submissions" />;

  const nPages = Math.ceil(relevantSubmissions?.length / 10 || 0);
  const pageData = relevantSubmissions?.slice((page - 1) * 10, page * 10);
  function nextPage() {
    setPage(Math.min(nPages, page + 1));
  }
  function prevPage() {
    setPage(Math.max(1, page - 1));
  }

  return (
    <div className="relative flex flex-col h-screen">
      <header className="flex  z-20 px-1 sticky top-0 w-full justify-center bg-foreground  text-white">
        <div className="flex flex-col md:flex-row w-full justify-between">
          <div className="flex flex-wrap md:flex-col p-2 gap-x-3 justify-between ">
            <h5 className="m-0">{project?.name || ''}</h5>
            <span className="italic">{reviewer?.email}</span>
          </div>
          <div
            className={`Pagination flex justify-end items-center p-2 pr-5 pt-0 md:pt-2 gap-1 md:gap-3 `}
          >
            <FaArrowLeft
              className={`w-6 h-6  ${
                page === 1
                  ? 'cursor-default text-gray-500'
                  : 'cursor-pointer text-blue-200 hover:text-blue-400'
              }`}
              onClick={prevPage}
            />
            <span className="font-bold min-w-[7rem] text-center select-none">
              Page {page} / {nPages}
            </span>
            <FaArrowRight
              className={`w-6 h-6  ${
                page === nPages
                  ? 'cursor-default text-gray-500'
                  : 'cursor-pointer text-blue-200 hover:text-blue-400'
              }`}
              onClick={nextPage}
            />
          </div>
        </div>
      </header>
      <div className="mt-3 max-h-full grid grid-cols-[auto,1fr] gap-1 md:gap-5 p-1 md:p-3 overflow-hidden">
        <div className="grid auto-rows-min justify-center  max-h-full md:pr-3 w-12 md:w-20">
          <div>
            <GiVote className="w-8 h-8 md:w-12 md:h-12 mb-2" />
          </div>
          {[...selected].map((id, i) => {
            return (
              <div
                key={id}
                className={`relative border-2 rounded border-primary px-1 md:px-2 mt-1 cursor-pointer text-center ${
                  focusSelected === id ? 'bg-blue-300' : 'hover:bg-blue-300'
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setFocusSelected(focusSelected === id ? undefined : id);
                }}
              >
                {i + 1}
              </div>
            );
          })}
        </div>
        <div
          className={`flex justify-center overflow-auto max-h-full ${
            focusSelected ? 'blur-[2px] opacity-50' : ''
          }`}
        >
          <div className="">
            <div className="relative flex gap-3 items-start select-none">
              <h5>Select X submissions that you would be willing to review </h5>
              <div className="peer">
                <FaQuestionCircle className="w-6 h-6   text-blue-600" />
              </div>
              <div
                className={`absolute text-[14px] top-10 right-0 bg-blue-200 border-2 border-primary rounded p-3 hidden peer-hover:block peer-active:block`}
              >
                <h5 className="mb-1">What is this about?</h5>
                <p>
                  We ask you to bid on more submissions that you will need to review, so that we can
                  assign submissions to you that match your interests and expertise
                </p>
                <h5 className="mb-1">How will I find submissions that I&apos;m interested in?</h5>
                <p>
                  The submissions are ordered based on similarity to your own (earlier) submissions
                </p>
                <h5 className="mb-1">How does this thing work?</h5>

                <p>
                  Click on the title of a submission to see the abstract. Check the checkbox to bid
                  on a submission. Selected submissions are listed on the left. Click on a selected
                  submission to see an optionally unselect it.
                </p>
              </div>
            </div>
            {pageData?.map((submission) => {
              return (
                <SubmissionItem
                  key={submission.id}
                  projectId={Number(params.project)}
                  submission={submission}
                  selected={selected}
                  setSelected={setSelected}
                />
              );
            })}
          </div>
        </div>
        <div
          ref={popupRef}
          className={`FocusSelectedPopup absolute left-12 md:left-32 bg-white border-2 rounded bg-primary p-4 ${
            focusSelected ? '' : 'hidden'
          }`}
        >
          <SubmissionItem
            projectId={Number(params.project)}
            submission={submissions?.find((s: GetSubmission) => s.id === focusSelected)}
            selected={selected}
            setSelected={setSelected}
          />
        </div>
      </div>
    </div>
  );
}

interface SubmissionProps {
  projectId: number;
  submission?: GetSubmission;
  selected: Set<number>;
  setSelected: Dispatch<SetStateAction<Set<number>>>;
}

function SubmissionItem({ projectId, submission, selected, setSelected }: SubmissionProps) {
  const [submissionId, setSubmissionId] = useState<number>();
  const [showAbstract, setShowAbstract] = useState(false);
  const { data: abstractData, isLoading } = useAbstract(projectId, submissionId);

  async function onClick() {
    if (!submission) return;
    if (submissionId === undefined) setSubmissionId(submission.id);
    setShowAbstract(!showAbstract);
  }

  async function onCheckboxClick() {
    setSelected((prev: Set<number>) => {
      if (!submission) return prev;
      const newSet = new Set(prev);
      if (newSet.has(submission.id)) {
        newSet.delete(submission.id);
      } else {
        newSet.add(submission.id);
      }
      return newSet;
    });
  }

  const fadeOutBefore =
    'before:absolute before:content-[""] before:left-0 before:top-0 before:w-[calc(100%-10px)] before:h-2 before:bg-gradient-to-t from-transparent to-white';
  const fadeOutAfter =
    'after:absolute after:content-[""] after:left-0 after:bottom-0 after:w-[calc(100%-10px)] after:h-8 after:bg-gradient-to-b from-transparent to-white ';

  if (!submission) return null;

  return (
    <div
      key={submission.id}
      id={String(submission.id)}
      className="grid grid-rows-[auto,auto] grid-cols-[auto,1fr,auto] max-w-xl gap-x-3 md:gap-x-6 pt-3 pb-2 "
    >
      <div className="">
        <input
          type="checkbox"
          checked={selected.has(submission.id)}
          onChange={onCheckboxClick}
          className="w-4 h-4 mt-[0.35rem] md:w-8 md:h-8"
        />
      </div>
      {/* <div className="flex flex-col"> */}
      <h6
        className="cursor-pointer mb-0 hyphens-auto break-words whitespace-break-spaces"
        onClick={onClick}
      >
        {submission.title}
      </h6>
      {/* </div> */}
      <div className="h-4 w-4 mt-1">
        {isLoading ? <FaClock /> : showAbstract ? <FaChevronDown /> : <FaChevronRight />}
      </div>
      <div className={` flex items-center col-start-2 col-end-4 m-0 mt-1`}>
        <div
          className={`grid  ${
            showAbstract && abstractData ? 'grid-rows-[15rem]' : 'grid-rows-[0rem]'
          }  relative transition-all overflow-hidden  text-justify  whitespace-break-spaces hyphens-auto break-words  ${fadeOutBefore} ${fadeOutAfter}`}
        >
          {abstractData ? (
            <p className={`pb-4 pt-1 mb-0  overflow-auto pr-2 `}>{abstractData.abstract}</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
