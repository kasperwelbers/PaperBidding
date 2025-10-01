import { Button } from "@/components/ui/button";

import { GetReviewer } from "@/types";
import { useEffect, useMemo, useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";

import { useCSVDownloader } from "react-papaparse";
import { sendInvitation } from "./sendInvitation";
import { Loading } from "@/components/ui/loading";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

interface Props {
  projectId: number;
  division: string;
  deadline: string;
  reviewers: GetReviewer[];
  mutateReviewers: () => void;
}

export default function Invitations({
  projectId,
  division,
  deadline,
  reviewers,
  mutateReviewers,
}: Props) {
  return (
    <EmailModal
      projectId={projectId}
      division={division}
      deadline={deadline}
      reviewers={reviewers}
      mutateReviewers={mutateReviewers}
    />
  );
}

interface EmailModalProps {
  projectId: number;
  division: string;
  deadline: string;
  reviewers: GetReviewer[];
  mutateReviewers: () => void;
}

function EmailModal({
  projectId,
  division,
  deadline,
  reviewers,
  mutateReviewers,
}: EmailModalProps) {
  const [text1, setText1] = useState(getText1Default(division));
  const [text2, setText2] = useState(getText2Default(deadline));

  useEffect(() => {
    setText1(getText1Default(division));
  }, [division]);
  useEffect(() => {
    setText2(getText2Default(deadline));
  }, [deadline]);

  return (
    <div className="relative overflow-auto m-4 2xl:m-10 z-50 border-primary rounded ">
      <div className="grid grid-cols-1  lg:grid-cols-[1fr,max-content] gap-3">
        <div className="border p-3 max-w-2xl  bg-secondary">
          <h4>Email template</h4>
          <p>You can customize the intro and outro</p>
          <Textarea
            name="intro"
            value={text1}
            onChange={(e) => setText1(e.target.value)}
            rows={10}
          />
          <div className="p-3 pt-5">
            <p className="text-sm">
              To start the paper bidding, please visit{" "}
              <span className="text-blue-800 underline">
                this link right here
              </span>
            </p>
          </div>
          <Textarea
            value={text2}
            onChange={(e) => setText2(e.target.value)}
            rows={6}
          />
        </div>
        <div className="grid grid-cols-1  mx-auto max-w-xl  gap-8 mt-8">
          <SendTestEmail
            projectId={projectId}
            reviewers={reviewers}
            text1={text1}
            text2={text2}
            division={division}
          />
          <SendBulkEmail
            projectId={projectId}
            reviewers={reviewers}
            text1={text1}
            text2={text2}
            division={division}
            mutateReviewers={mutateReviewers}
          />
        </div>
      </div>
    </div>
  );
}

interface SendTestEmailProps {
  projectId: number;
  reviewers: GetReviewer[];
  text1: string;
  text2: string;
  division: string;
}

function SendTestEmail({
  projectId,
  reviewers,
  text1,
  text2,
  division,
}: SendTestEmailProps) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    sendInvitation(
      projectId,
      email,
      reviewers[0].link,
      text1,
      text2,
      division,
      true,
    )
      .then((success) => {
        if (success) alert("Email sent!");
        else alert("Something went wrong, email not sent");
        setEmail("");
      })
      .finally(() => setSending(false));
  }

  if (sending) return <Loading msg={`Sending test email`} />;

  return (
    <form className="flex flex-col justify-center" onSubmit={onSubmit}>
      <h3 className="text-center">Send test email</h3>

      <input
        className="border-2 border-primary px-3 py-1 rounded "
        type="email"
        name="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button
        disabled={sending}
        className={`border-2 border-primary  px-3 py-1 rounded mt-2`}
      >
        Send test email
      </Button>
    </form>
  );
}

interface SendBulkEmailProps {
  projectId: number;
  reviewers: GetReviewer[];
  text1: string;
  text2: string;
  division: string;
  mutateReviewers: () => void;
}

function SendBulkEmail({
  projectId,
  reviewers,
  text1,
  text2,
  division,
  mutateReviewers,
}: SendBulkEmailProps) {
  const [who, setWho] = useState("");
  const [progress, setProgress] = useState<number | null>(null);

  const uninvited = useMemo(() => {
    return reviewers.filter((r) => !r.invitationSent);
  }, [reviewers]);
  const recipients = who === "uninvited" ? uninvited : reviewers;

  function start(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setProgress(0);
  }

  function cancel(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.preventDefault();
    setProgress(null);
  }

  useEffect(() => {
    if (progress === null) return;
    if (progress >= recipients.length) {
      mutateReviewers();
      setProgress(null);
      return;
    }

    const recipient = recipients[progress];
    if (recipient.invitationSent) {
      const date = new Date(recipient.invitationSent);
      if (date.getTime() > Date.now() - 6 * 60 * 60 * 1000) {
        setProgress(progress + 1);
        return;
      }
    }
    sendInvitation(
      projectId,
      recipient.email,
      recipient.link,
      text1,
      text2,
      division,
    ).then((success) => {
      if (success) {
        // wait 500ms before sending the next email for resend api limits
        setTimeout(() => setProgress(progress + 1), 500);
      } else {
        alert(
          `Something went wrong. Only ${progress} emails were sent. But you can just try again. Reviewers will receive max 1 email per 6 hours, so you don't have to worry about spamming them`,
        );
        mutateReviewers();
        setProgress(null);
      }
    });
  }, [
    recipients,
    progress,
    mutateReviewers,
    projectId,
    reviewers,
    text1,
    text2,
    division,
  ]);

  if (progress !== null) {
    return (
      <div className="flex flex-col ">
        <h2 className="text-center mt-0">
          {progress + 1} / {recipients?.length}
        </h2>
        <span className="italic text-center">
          {" "}
          {recipients?.[progress]?.email}
        </span>
        <Button
          onClick={cancel}
          variant="destructive"
          className="mt-auto w-full"
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <form className="flex flex-col justify-center" onSubmit={start}>
      <h3 className="text-center">Send bulk email</h3>

      <RadioGroup
        orientation="horizontal"
        className="flex flex-wrap  h-10"
        value={who}
        onValueChange={(v) => setWho(v)}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="uninvited" id="option-one" />
          <Label htmlFor="option-one">
            Only uninvited ({uninvited.length})
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="everyone" id="option-two" />
          <Label htmlFor="option-two">Everyone ({reviewers.length})</Label>
        </div>
      </RadioGroup>

      <Button
        disabled={who === ""}
        variant={who === "" ? "secondary" : "default"}
        className={`border-2 border-primary  px-3 py-1 rounded mt-2 `}
      >
        {who === "" ? "select recipients" : "Send emails"}
      </Button>
    </form>
  );
}

function getText1Default(division: string) {
  return `Dear member of the ${division} division,

The ICA submissions are in, and it's time to review!

To help us assign the right reviewers to the right papers, we ask you to indicate which papers match your expertise and interest. The following link shows you the abstracts sorted by similarity to your own work. Please take a few minutes to indicate which papers you would like to review.

`;
}
function getText2Default(deadline: string) {
  return `The deadline for indicating your preferences is already on November 6th, so please act quickly if you want to bid. If you do not bid on any papers, you will automatically be matched to remaining papers based on similarity to your own submissions.

Happy bidding!`;
}
