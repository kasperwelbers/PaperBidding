'use client';

import { Error } from '@/components/ui/error';
import { Loading } from '@/components/ui/loading';
import { Submission } from '@/drizzle/schema';
import { useAbstract, useAllData, useReviewer } from '@/hooks/api';
import { useEffect, useRef, useState } from 'react';
import { FaChevronDown, FaChevronRight, FaClock } from 'react-icons/fa';

export default function Reviewer({ params }: { params: { project: number; reviewer: number } }) {
  const { allData: submissions, isLoading, error } = useAllData(params.project, 'submissions');
  const {
    data: reviewer,
    isLoading: isLoadingReviewer,
    error: errorReviewer
  } = useReviewer(params.project, params.reviewer);
  console.log(submissions);
  console.log(reviewer);

  if (isLoading) return <Loading msg="Loading Project" />;
  if (error) return <Error msg={error} />;
  if (isLoadingReviewer) return <Loading msg="Loading Reviewer" />;
  if (errorReviewer) return <Error msg={errorReviewer.message} />;

  return (
    <div className="flex flex-col items-center">
      <div className="flex flex-col p-3">
        {submissions?.map((submission) => {
          return <Submission projectId={Number(params.project)} submission={submission} />;
        })}
      </div>
    </div>
  );
}

interface SubmissionProps {
  projectId: number;
  submission: Submission;
}

function Submission({ projectId, submission }: SubmissionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [submissionId, setSubmissionId] = useState<number>();
  const [showAbstract, setShowAbstract] = useState(false);
  const { data: abstractData, isLoading } = useAbstract(projectId, submissionId);

  async function onClick() {
    if (submissionId === undefined) setSubmissionId(submission.id);
    setShowAbstract(!showAbstract);
  }

  useEffect(() => {
    if (ref.current) {
      console.log(ref.current.scrollHeight);
      ref.current.style.gridTemplateRows = showAbstract ? ref.current.scrollHeight + 'px' : '0px';
    }
    const timer = setTimeout(() => {
      if (showAbstract && ref.current) ref.current.style.gridTemplateRows = 'auto';
    }, 2000);
    return () => clearTimeout(timer);
  }, [ref, showAbstract, abstractData]);

  return (
    <div className="grid grid-cols-[auto,1fr,auto] max-w-xl gap-6 my-1 py-1 border-solid border-t-slate-500 border-t-2">
      <div>
        <input type="checkbox" className="w-8 h-8 mt-[0.45rem]" />
      </div>
      <div className="flex flex-col">
        <h6 className="cursor-pointer mb-0  gap-2" onClick={onClick}>
          {submission.title}
        </h6>
        <div className="flex items-center">
          <div ref={ref} className="grid transition-all overflow-hidden">
            {abstractData ? <p className="pb-10">{abstractData.abstract}</p> : null}
          </div>
        </div>
      </div>
      <div className="h-8 w-8 mt-1">
        {isLoading ? <FaClock /> : showAbstract ? <FaChevronDown /> : <FaChevronRight />}
      </div>
    </div>
  );
}
