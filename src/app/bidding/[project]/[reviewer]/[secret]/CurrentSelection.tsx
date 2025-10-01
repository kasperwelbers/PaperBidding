import { GetSubmission } from "@/types";
import SubmissionItem from "./SubmissionItem";

import { Reorder } from "./Reorder";

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
          <div key={id} className="flex  gap-3 items-center">
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
