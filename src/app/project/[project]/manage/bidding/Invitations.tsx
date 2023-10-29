'use client';

import { Button } from '@/components/ui/button';

import { GetReviewer } from '@/types';
import { useEffect, useRef, useState } from 'react';
import { Textarea } from '@/components/ui/textarea';

import { useCSVDownloader } from 'react-papaparse';
import { sendInvitation } from './sendInvitation';

interface Props {
  reviewers: GetReviewer[];
}

export default function Invitations({ reviewers }: Props) {
  const { CSVDownloader, Type } = useCSVDownloader();
  const modalRef = useRef<HTMLDivElement>(null);
  const [sendModal, setSendModal] = useState(false);

  function clickSend(e: any) {
    e.preventDefault();
    setSendModal(!sendModal);
  }

  return (
    <div className="grid grid-cols-[1fr,2fr] items-center gap-4 border-2 border-primary rounded p-3">
      <div>
        <h3 className="text-center">Invitations</h3>
        <div className="grid grid-cols-1 gap-2">
          <CSVDownloader
            type={Type.Button}
            className="flex-auto"
            filename={`reviewer_invitations.csv`}
            bom={true}
            data={reviewers}
          >
            <Button className="w-full bg-secondary text-primary hover:text-secondary">
              Download
            </Button>
          </CSVDownloader>
          <Button
            className="flex-auto bg-secondary text-primary hover:text-secondary"
            onClick={clickSend}
          >
            Send
          </Button>
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
        <EmailModal reviewers={reviewers} clickSend={clickSend} />
      </div>
    </div>
  );
}

interface EmailModalProps {
  reviewers: GetReviewer[];
  clickSend: (e: any) => void;
}

function EmailModal({ reviewers, clickSend }: EmailModalProps) {
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
        <div className="mt-8">
          <SendTestEmail reviewers={reviewers} text1={text1} text2={text2} />
        </div>
      </div>
    </div>
  );
}

interface SendTestEmailProps {
  reviewers: GetReviewer[];
  text1: string;
  text2: string;
}

function SendTestEmail({ reviewers, text1, text2 }: SendTestEmailProps) {
  const [email, setEmail] = useState('');

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    sendInvitation(email, reviewers[0].firstname, reviewers[0].link, text1, text2).then(
      (success) => {
        if (success) alert('Email sent!');
        else alert('Something went wrong, email not sent');
        setEmail('');
      }
    );
  }

  return (
    <form className="flex flex-col justify-center" onSubmit={onSubmit}>
      <input
        className="border-2 border-primary px-3 py-1 rounded mt-2"
        type="email"
        name="email"
        placeholder="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />
      <button className="border-2 border-primary bg-secondary px-3 py-1 rounded mt-2">
        Send test email
      </button>
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
