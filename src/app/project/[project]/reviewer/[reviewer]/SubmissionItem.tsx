'use client';

import { useAbstract, useBid } from '@/hooks/api';
import { GetSubmission } from '@/types';
import { SetStateAction, useState, Dispatch } from 'react';
import { FaChevronDown, FaChevronRight, FaClock } from 'react-icons/fa';

interface SubmissionProps {
  projectId: number;
  reviewerId: number;
  submission?: GetSubmission;
  selected: Set<number>;
  setSelected: Dispatch<SetStateAction<Set<number>>>;
}

export default function SubmissionItem({
  projectId,
  reviewerId,
  submission,
  selected,
  setSelected
}: SubmissionProps) {
  const [submissionId, setSubmissionId] = useState<number>();
  const [showAbstract, setShowAbstract] = useState(false);
  const { trigger: makeBid } = useBid(projectId, reviewerId);
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
        makeBid({ submission: submission.id, delete: true });
        newSet.delete(submission.id);
      } else {
        makeBid({ submission: submission.id, delete: false });

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
        className={`cursor-pointer mb-0 hyphens-auto break-words whitespace-break-spaces ${
          showAbstract ? '' : 'font-normal'
        }`}
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
            <p className={`pb-4 pt-1 mb-0  overflow-auto pr-2  text-blue-900 `}>
              {abstractData.abstract}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
