import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAbstract } from "@/hooks/api";
import { GetSubmission } from "@/types";
import { ZoomIn } from "lucide-react";
import { SetStateAction, useState, Dispatch } from "react";
import { FaChevronDown, FaChevronRight, FaClock } from "react-icons/fa";
import { GiVote } from "react-icons/gi";
import { Reorder } from "./Reorder";

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

  const checked = selected.includes(submission.id);
  const currentPosition = selected.indexOf(submission.id);

  return (
    <div
      key={submission.id}
      id={String(submission.id)}
      className="w-full border-b pb-3 rounded  grid grid-rows-[auto,auto] items-start grid-cols-[auto,auto,1fr]  gap-x-1 px-3 md:gap-x-3  "
    >
      <Reorder
        i={currentPosition}
        selected={selected}
        setSelected={setSelected}
      />
      <div className="">
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheckboxClick}
          className="w-6 h-6 mt-[0.35rem]"
        />
      </div>
      {/* <div className="flex flex-col"> */}
      <h6
        className={`ml-3 line-clamp-2 cursor-pointer text-pretty prose-sm mb-0 hyphens-auto break-words whitespace-break-spaces ${
          showAbstract ? "" : "font-normal"
        }`}
        onClick={onClick}
      >
        {submission.title}
      </h6>
      {/* </div> */}
      {/*<div
        className="h-4 w-4 mt-1 cursor-pointer text-foreground/50"
        onClick={onClick}
      >
        {isLoading ? <FaClock /> : <ZoomIn className="w-5 h-5" />}
      </div>*/}
      <AbstractDialog
        checked={selected.includes(submission.id)}
        onCheck={onCheckboxClick}
        title={submission.title}
        abstract={abstractData?.abstract}
        showAbstract={showAbstract}
        setShowAbstract={setShowAbstract}
      />
    </div>
  );
}

export function SubmissionItemTitle() {
  return (
    <div className="select-none text-primary/50 w-full border-b pb-3 rounded  grid grid-rows-[auto,auto] items-start grid-cols-[auto,auto,1fr]  gap-x-1 px-3 md:gap-x-3  ">
      <div className="w-12">rank</div>
      <div className="w-9">bid</div>
      <div className="flex gap-2 items-center">
        submission<span className="text-xs">(click to see abstract)</span>
      </div>
    </div>
  );
}

function AbstractDialog({
  checked,
  onCheck,
  title,
  abstract,
  showAbstract,
  setShowAbstract,
}: {
  checked: boolean;
  onCheck: (e: any) => void;
  title: string;
  abstract?: string;
  showAbstract: boolean;
  setShowAbstract?: Dispatch<SetStateAction<boolean>>;
}) {
  return (
    <Dialog open={showAbstract} onOpenChange={setShowAbstract}>
      <DialogContent className="max-h-[90vh] flex flex-col gap-0 w-[600px] max-w-[95vw]">
        <div className=" text-foreground/60 flex items-center gap-3 mb-4">
          <input
            type="checkbox"
            checked={checked}
            onChange={onCheck}
            className="w-6 h-6"
          />
          Place bid
        </div>
        <DialogHeader>
          <DialogTitle>
            <h5 className="text-left text-sm md:text-base">{title}</h5>
          </DialogTitle>
          <DialogDescription className="sr-only">
            Shows abstract
          </DialogDescription>
        </DialogHeader>
        <div className="prose text-justify break-words hyphens-auto ">
          <div className="text-foreground text-sm md:text-base overflow-auto max-h-[400px] h-[50vh] p-3 bg-foreground/10 rounded">
            {abstract || "...loading"}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
