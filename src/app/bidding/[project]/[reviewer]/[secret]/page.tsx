'use client';

import { Error } from '@/components/ui/error';
import { Loading } from '@/components/ui/loading';
import { useAllData, useProject, useReviewer } from '@/hooks/api';
import { computeRelevantSubmissions } from '@/lib/computeRelevantSubmissions';
import { GetSubmission } from '@/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FaArrowLeft, FaArrowRight, FaQuestionCircle } from 'react-icons/fa';
import { GiVote } from 'react-icons/gi';
import SubmissionItem from './SubmissionItem';
import useSelection from './useSelection';
import CurrentSelection from './CurrentSelection';

export default function Reviewer({
  params
}: {
  params: { project: number; reviewer: number; secret: number };
}) {
  const token = params.reviewer + '/' + params.secret;

  const {
    data: submissions,
    isLoading,
    error
  } = useAllData<GetSubmission>(params.project, 'submissions', token);
  const {
    data: reviewer,
    isLoading: isLoadingReviewer,
    error: errorReviewer
  } = useReviewer(params.project, params.reviewer, token);

  const { selected, setSelected, selectionStatus } = useSelection(
    params.project,
    params.reviewer,
    token
  );

  const [showSelected, setShowSelected] = useState(false);
  const [page, setPage] = useState(1);
  const { data: project } = useProject(params.project);
  const projectName = project?.name || '';
  const popupRef = useRef<HTMLDivElement>(null);

  const relevantSubmissions = useMemo(() => {
    return computeRelevantSubmissions(submissions, reviewer);
  }, [submissions, reviewer]);

  useEffect(() => {
    function closePopup(e: MouseEvent) {
      if (popupRef.current?.contains(e.target as Node)) return;
      setShowSelected(false);
    }
    window.addEventListener('mousedown', closePopup);
    return () => window.removeEventListener('mousedown', closePopup);
  }, [popupRef]);

  if (isLoading) return <Loading msg="Loading Submissions" />;
  if (error) return <Error msg={error.message} />;
  if (isLoadingReviewer) return <Loading msg="Loading Reviewer" />;
  if (errorReviewer) return <Error msg={errorReviewer.message} />;
  if (!relevantSubmissions) return <Loading msg="Ranking Submissions" />;
  if (!submissions) return <Loading msg="Loading Submissions" />;
  if (selectionStatus === 'loading') return <Loading msg="Loading Selection" />;
  if (selectionStatus === 'error')
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
            ? 'cursor-default text-gray-300'
            : 'cursor-pointer text-blue-500 hover:text-blue-700'
        }`}
        onClick={prevPage}
      />
      <span className="font-bold min-w-[7rem] text-center select-none">
        Page {page} / {nPages}
      </span>
      <FaArrowRight
        className={`w-6 h-6  ${
          page === nPages
            ? 'cursor-default text-gray-300'
            : 'cursor-pointer text-blue-500 hover:text-blue-700'
        }`}
        onClick={nextPage}
      />
    </div>
  );

  return (
    <div className="relative flex flex-col h-screen">
      <header className="flex  z-20 px-1 sticky top-0 w-full justify-center bg-foreground  text-white">
        <div className="flex flex-col md:flex-row w-full justify-between">
          <div className="flex flex-wrap md:flex-col p-2 gap-x-3 justify-between ">
            <h5 className="m-0">{projectName.replaceAll('_', ' ')}</h5>
            <span className="italic text-sm">{reviewer?.email}</span>
          </div>
        </div>
      </header>
      <div className="mt-3 h-full grid grid-cols-[auto,1fr] gap-3 md:gap-5 p-3 md:p-3 overflow-hidden">
        <div
          className="flex flex-col hover:bg-blue-300 h-min p-0 md:p-3 rounded cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            setShowSelected(!showSelected);
          }}
        >
          <div>
            <GiVote className="w-8 h-8 md:w-12 md:h-12 mb-2" />
          </div>
          <div
            className={`flex justify-center items-center animate-fade-in h-10 text-sm md:text-lg align-middle relative rounded border-primary px-1 md:px-2 mt-1 cursor-pointer text-center `}
          >
            <sup>{selected.length}</sup>&frasl;<sub>10</sub>
          </div>
        </div>
        <div
          className={`flex justify-center h-full overflow-auto max-h-full ${
            showSelected ? 'blur-[2px] opacity-50 pointer-events-none' : ''
          }`}
        >
          <div className="flex flex-col">
            <div className="relative flex gap-3 items-start select-none">
              <h5>Select 10 submissions that you would be willing to review </h5>
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
            <div className="flex justify-center">{pagination}</div>
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
            <div className="flex justify-center mt-auto">{pagination}</div>
          </div>
        </div>

        <div
          ref={popupRef}
          className={`FocusSelectedPopup absolute z-50 top-5 left-12 md:left-32 bg-white border-2 rounded bg-primary p-4 max-h-[80vh] overflow-auto ${
            showSelected ? '' : 'hidden'
          }`}
        >
          <CurrentSelection
            selected={selected}
            setSelected={setSelected}
            projectId={Number(params.project)}
            reviewerId={Number(params.reviewer)}
            token={token}
            submissions={submissions}
          />
        </div>
      </div>
    </div>
  );
}
