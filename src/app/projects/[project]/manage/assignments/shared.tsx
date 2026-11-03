import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { defaultRegistrationUrl } from "@/lib/registrationUrl";
import { useState } from "react";
import { FaCopy, FaVideo } from "react-icons/fa";

/** Link to the ScholarOne (abstractcentral) site for the conference that this
 *  project's bidding is for */
export function ScholarOneLink({
  created,
  children = "ScholarOne",
}: {
  created: Date | string;
  children?: React.ReactNode;
}) {
  return (
    <a
      target="_blank"
      rel="noreferrer"
      href={defaultRegistrationUrl(new Date(created))}
      className="underline text-blue-900"
    >
      {children}
    </a>
  );
}

export function CopyText({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <Button
      size="icon"
      variant="ghost"
      className="relative"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 500);
      }}
    >
      <FaCopy />
      {copied ? (
        <div className="absolute -bottom-4 right-0 animate-slide-in">
          Copied!
        </div>
      ) : null}
    </Button>
  );
}

export function UploadAssignmentsVideo() {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="text-blue-900 underline flex gap-2 w-max"
        >
          <FaVideo />
          show me
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[1000px]  overflow-auto">
        <div className="flex flex-col items-center min-w-[400px] pt-6">
          <video id="instruction-video" autoPlay muted controls>
            <source src="/assign_reviewers.webm" type="video/webm" />
          </video>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Control IDs per reviewer, from the byReviewer assignments */
export function controlIdsByReviewer(
  byReviewer: Record<string, string>[],
): { reviewer: string; student: string; canReview: string; ids: string[] }[] {
  return byReviewer.map((r) => {
    const ids: string[] = [];
    for (const [col, value] of Object.entries(r)) {
      if (col.startsWith("submission_") && value) ids.push(value);
    }
    return {
      reviewer: r.reviewer,
      student: r.student,
      canReview: r.canReview,
      ids,
    };
  });
}

export interface IcaMatch {
  /** reviewers with at least one assigned submission */
  assigned: number;
  /** assigned reviewers that have an ICA Person ID */
  matched: number;
  unmatchedEmails: string[];
  /** one row per (matched reviewer, control ID) pair, in the ICA template format */
  rows: { "Person ID": string; "Control ID": string }[];
}

/** Match assigned reviewers to ICA Person IDs (personIds keys are lowercased emails) */
export function computeIcaMatch(
  byReviewer: Record<string, string>[],
  personIds: Record<string, string>,
): IcaMatch {
  let assigned = 0;
  let matched = 0;
  const unmatchedEmails: string[] = [];
  const rows: IcaMatch["rows"] = [];

  for (const r of controlIdsByReviewer(byReviewer)) {
    if (r.ids.length === 0) continue;
    assigned++;
    const personId = personIds[r.reviewer.trim().toLowerCase()];
    if (!personId) {
      unmatchedEmails.push(r.reviewer);
      continue;
    }
    matched++;
    for (const id of r.ids) rows.push({ "Person ID": personId, "Control ID": id });
  }
  unmatchedEmails.sort((a, b) => a.localeCompare(b));
  return { assigned, matched, unmatchedEmails, rows };
}
