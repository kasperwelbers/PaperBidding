import { useAbstract } from "@/hooks/api";
import { GetSubmission } from "@/types";
import { SetStateAction, useState, Dispatch } from "react";
import { FaChevronDown, FaChevronRight, FaClock } from "react-icons/fa";

interface SubmissionProps {
  projectId: number;
  reviewerId: number;
  token: string;
  submission?: GetSubmission;
  selected: number[];
  setSelected: (selected: number[]) => void;
}

export default function SubmissionItem({
  projectId,
  reviewerId,
  token,
  submission,
  selected,
  setSelected,
}: SubmissionProps) {
  const [submissionId, setSubmissionId] = useState<number>();
  const [showAbstract, setShowAbstract] = useState(false);
  const { data: abstractData, isLoading } = useAbstract(
    projectId,
    submissionId,
    token,
  );

  async function onClick() {
    if (!submission) return;
    if (submissionId === undefined) setSubmissionId(submission.id);
    setShowAbstract(!showAbstract);
  }

  async function onCheckboxClick(e: any) {
    e.stopPropagation();
    if (!submission) return;
    const newSet = [...selected];

    if (newSet.includes(submission.id)) {
      newSet.splice(newSet.indexOf(submission.id), 1);
    } else {
      newSet.push(submission.id);
    }
    setSelected(newSet);
  }

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
          checked={selected.includes(submission.id)}
          onChange={onCheckboxClick}
          className="w-6 h-6 mt-[0.35rem]"
        />
      </div>
      {/* <div className="flex flex-col"> */}
      <h6
        className={`cursor-pointer mb-0 hyphens-auto break-words whitespace-break-spaces ${
          showAbstract ? "" : "font-normal"
        }`}
        onClick={onClick}
      >
        {submission.title}
      </h6>
      {/* </div> */}
      <div
        className="h-4 w-4 mt-1 cursor-pointer text-foreground/50"
        onClick={onClick}
      >
        {isLoading ? (
          <FaClock />
        ) : showAbstract ? (
          <FaChevronDown />
        ) : (
          <FaChevronRight />
        )}
      </div>
      <div className={` flex items-center col-start-2 col-end-4 m-0 mt-1`}>
        <div
          className={`grid  ${
            showAbstract && abstractData
              ? "grid-rows-[15rem] border-y border-foreground bg-primary/10 mt-3"
              : "grid-rows-[0rem]"
          } w-full  relative transition-all overflow-hidden  text-justify  whitespace-break-spaces hyphens-auto break-words`}
        >
          {abstractData ? (
            <p className={` leading-5 py-3  px-3  mb-0  overflow-auto  `}>
              {abstractData.abstract}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
