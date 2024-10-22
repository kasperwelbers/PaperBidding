import { GetSubmission } from "@/types";
import SubmissionItem from "./SubmissionItem";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useEffect, useState } from "react";

interface Props {
  selected: number[];
  setSelected: (selected: number[]) => void;
  projectId: number;
  reviewerId: number;
  token: string;
  submissions?: GetSubmission[];
}

export default function CurrentSelection({
  selected,
  setSelected,
  projectId,
  reviewerId,
  token,
  submissions,
}: Props) {
  return (
    <>
      {selected.length === 0 ? "No submissions selected" : null}
      {selected.map((id, i) => {
        return (
          <div key={id} className="flex  gap-3">
            <div className="pt-[0.9rem]">
              <Reorder i={i} selected={selected} setSelected={setSelected} />
            </div>
            <SubmissionItem
              projectId={projectId}
              reviewerId={reviewerId}
              token={token}
              submission={submissions?.find((s: GetSubmission) => s.id === id)}
              selected={selected}
              setSelected={setSelected}
            />
          </div>
        );
      })}
    </>
  );
}

interface ReorderProps {
  i: number;
  selected: number[];
  setSelected: (selected: number[]) => void;
}

function Reorder({ i, selected, setSelected }: ReorderProps) {
  const [open, setOpen] = useState(false);

  function onSelect(e: any) {
    const from = i;
    const to = Number(e);
    const newSet = [...selected];
    const [removed] = newSet.splice(from, 1);
    newSet.splice(to, 0, removed);
    setSelected(newSet);
  }

  useEffect(() => {
    function blockmouseevents(e: any) {
      e.stopPropagation();
    }
    if (open) {
      document.addEventListener("mousedown", blockmouseevents);
      document.addEventListener("touchstart", blockmouseevents);
    }
    return () => {
      document.removeEventListener("mousedown", blockmouseevents);
      document.removeEventListener("touchstart", blockmouseevents);
    };
  }, [open]);

  return (
    <Select
      onOpenChange={setOpen}
      value={String(i)}
      onValueChange={onSelect}
      defaultValue={String(i + 1)}
    >
      <SelectTrigger
        className="w-10 flex justify-center"
        ref={(ref) =>
          ref?.addEventListener("touchend", (e) => e.preventDefault())
        }
      >
        <SelectValue placeholder={i + 1}>{i + 1}</SelectValue>
      </SelectTrigger>
      <SelectContent
        className="pointer-events-none"
        onMouseDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        {selected.map((id, j) => {
          if (i === j) return null;
          return (
            <SelectItem key={id} value={String(j)}>
              {j + 1}
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
