'use client';

import { Button } from '@/components/ui/button';

import { GetReviewer } from '@/types';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';

import { useCSVDownloader } from 'react-papaparse';
import { sendInvitation } from './sendInvitation';
import { Loading } from '@/components/ui/loading';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';

interface Props {
  projectId: number;
  reviewers: GetReviewer[];
  mutateReviewers: () => void;
}

export default function Invitations({ projectId, reviewers, mutateReviewers }: Props) {
  const { CSVDownloader, Type } = useCSVDownloader();
  const modalRef = useRef<HTMLDivElement>(null);
  const [sendModal, setSendModal] = useState(false);

  function clickSend(e: any) {
    e.preventDefault();
    setSendModal(!sendModal);
  }

  return (
    <div className="grid grid-cols-[1fr,2fr] items-center gap-4 border-2 border-primary rounded-lg p-3">
      <div>
        <h3 className="text-center">Invitations</h3>
        <div className="grid grid-cols-1 gap-2">
          <CSVDownloader
            type={Type.Button}
            className="flex-auto w-full bg-secondary text-primary p-1 rounded hover:text-secondary hover:bg-primary transition-colors"
            filename={`reviewer_invitations.csv`}
            bom={true}
            data={reviewers}
          >
            Download
          </CSVDownloader>
          <button
            className="flex-auto w-full bg-secondary text-primary p-1 rounded hover:text-secondary hover:bg-primary transition-colors"
            onClick={clickSend}
          >
            Send
          </button>
        </div>
      </div>
      <p className="whitespace-normal">
        To send the invitations, either download the CSV file and send the emails yourself, or send
        them directly from here. The emails will contain a link to the bidding page
      </p>

      <div
        ref={modalRef}
        className={`fixed z-50 inset-0 flex justify-center items-center bg-[#fff5] backdrop-blur-[5px] ${
          sendModal ? '' : 'hidden'
        }`}
      >
        <EmailModal
          projectId={projectId}
          reviewers={reviewers}
          mutateReviewers={mutateReviewers}
          clickSend={clickSend}
        />
      </div>
    </div>
  );
}

interface EmailModalProps {
  projectId: number;
  reviewers: GetReviewer[];
  mutateReviewers: () => void;
  clickSend: (e: any) => void;
}

function EmailModal({ projectId, reviewers, mutateReviewers, clickSend }: EmailModalProps) {
  const [text1, setText1] = useState(text1Default);
  const [text2, setText2] = useState(text2Default);

  return (
    <div className="relative overflow-auto m-4 md:m-10 z-50 w-[1000px] h-[1000px] max-h-[90%] max-w-[90%] border-2 border-primary rounded bg-secondary">
      <div className="sticky top-0 left-0 flex justify-between items-center bg-secondary p-4  border-b-[2px] border-primary">
        <h3>Send invitation emails</h3>
        <Button onClick={clickSend}>Cancel</Button>
      </div>
      <div className="p-4 md:p-8 pt-[10rem] ">
        <div className="p-3">
          <p>Dear [firstname],</p>
        </div>
        <Textarea value={text1} onChange={(e) => setText1(e.target.value)} rows={8} />
        <div className="p-3 pt-5">
          <p>
            To start the paper bidding, please visit{' '}
            <span className="text-blue-800 underline">this link right here</span>
          </p>
        </div>
        <Textarea value={text2} onChange={(e) => setText2(e.target.value)} rows={4} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          <SendTestEmail projectId={projectId} reviewers={reviewers} text1={text1} text2={text2} />
          <SendBulkEmail
            projectId={projectId}
            reviewers={reviewers}
            text1={text1}
            text2={text2}
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
}

function SendTestEmail({ projectId, reviewers, text1, text2 }: SendTestEmailProps) {
  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSending(true);
    sendInvitation(projectId, email, reviewers[0].firstname, reviewers[0].link, text1, text2, true)
      .then((success) => {
        if (success) alert('Email sent!');
        else alert('Something went wrong, email not sent');
        setEmail('');
      })
      .finally(() => setSending(false));
  }

  if (sending) return <Loading msg={`Sending test email to ${email}`} />;

  return (
    <form className="flex flex-col justify-center" onSubmit={onSubmit}>
      <h3 className="text-center">Send test email</h3>

      <input
        className="border-2 border-primary px-3 py-1 rounded mt-auto"
        type="email"
        name="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <Button disabled={sending} className={`border-2 border-primary  px-3 py-1 rounded mt-2`}>
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
  mutateReviewers: () => void;
}

function SendBulkEmail({
  projectId,
  reviewers,
  text1,
  text2,
  mutateReviewers
}: SendBulkEmailProps) {
  const [who, setWho] = useState('');
  const [progress, setProgress] = useState<number | null>(null);

  const uninvited = useMemo(() => {
    return reviewers.filter((r) => !r.invitationSent);
  }, [reviewers]);
  const recipients = who === 'uninvited' ? uninvited : reviewers;

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
    } else {
      const recipient = recipients[progress];
      if (recipient.invitationSent) {
        const date = new Date(recipient.invitationSent);
        if (date.getTime() > Date.now() - 24 * 60 * 60 * 1000) {
          setProgress(progress + 1);
          return;
        }
      }
      sendInvitation(
        projectId,
        recipient.email,
        reviewers[0].firstname,
        reviewers[0].link,
        text1,
        text2
      ).then((success) => {
        if (success) {
          setProgress(progress + 1);
        } else {
          alert(
            `Something went wrong. Only ${progress} emails were sent. But you can just try again. Reviewers will receive max 1 email per 24 hours, so you don't have to worry about spamming them`
          );
          mutateReviewers();
          setProgress(null);
        }
      });
    }
  }, [recipients, progress, mutateReviewers, projectId, reviewers, text1, text2]);

  if (progress !== null) {
    return (
      <div className="flex flex-col ">
        <h2 className="text-center mt-0">
          {progress + 1} / {recipients?.length}
        </h2>
        <span className="italic text-center"> {recipients?.[progress]?.email}</span>
        <Button onClick={cancel} variant="destructive" className="mt-auto w-full">
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
        className="grid grid-cols-2 mt-auto h-10"
        value={who}
        onValueChange={(v) => setWho(v)}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="uninvited" id="option-one" />
          <Label htmlFor="option-one">Only uninvited ({uninvited.length})</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="everyone" id="option-two" />
          <Label htmlFor="option-two">Everyone ({reviewers.length})</Label>
        </div>
      </RadioGroup>

      <Button
        disabled={who === ''}
        variant={who === '' ? 'secondary' : 'default'}
        className={`border-2 border-primary  px-3 py-1 rounded mt-2 `}
      >
        {who === '' ? 'select recipients' : 'Send emails'}
      </Button>
    </form>
  );
}

const text1Default = `First of all, thanks for being part of the Computational Methods division!

You are receiving this email because you volunteered to review for the Computational Methods group, 
or you submitted as first author to us, in which case we expect you to review as well.

As a reviewer, you can indicate which papers to review in a process known as 'paper bidding'.
The abstracts are sorted by similarity to your own submissions from this and previous years,
to help you find the papers that best fit your expertise.`;
const text2Default = `We will assign all papers for review on [date]. All reviews should be due by [date].

Happy bidding!`;
