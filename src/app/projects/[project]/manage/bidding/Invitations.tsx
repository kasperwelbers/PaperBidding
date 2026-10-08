import { Button } from "@/components/ui/button";

import { GetMetaSubmission, GetReviewer } from "@/types";
import { useEffect, useMemo, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";

import { useCSVDownloader } from "react-papaparse";
import { sendInvitation } from "./sendInvitation";
import { Loading } from "@/components/ui/loading";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useRegenerateJoinToken } from "@/hooks/api";
import { FaEye } from "react-icons/fa";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Tab = "overview" | "individual" | "general" | "reviewers";

type ReviewerStatus = "notInvited" | "invited" | "selfRegistered" | "done";
const statusLabels: Record<ReviewerStatus, string> = {
  notInvited: "Not yet invited",
  invited: "Invitation sent",
  selfRegistered: "Self-registered",
  done: "Done",
};
const statusColors: Record<ReviewerStatus, string> = {
  notInvited: "bg-gray-200 text-gray-800",
  invited: "bg-blue-100 text-blue-900",
  selfRegistered: "bg-amber-100 text-amber-900",
  done: "bg-green-100 text-green-900",
};

function reviewerStatus(reviewer: GetReviewer): ReviewerStatus {
  if (reviewer.biddings?.length > 0) return "done";
  if (reviewer.selfRegistered) return "selfRegistered";
  if (reviewer.invitationSent) return "invited";
  return "notInvited";
}

interface Props {
  projectId: number;
  division: string;
  deadline: string;
  joinToken: string;
  reviewers: GetReviewer[];
  submissions: GetMetaSubmission[];
  mutateReviewers: () => void;
  mutateProject: () => void;
}

export default function Invitations({
  projectId,
  division,
  deadline,
  joinToken,
  reviewers,
  submissions,
  mutateReviewers,
  mutateProject,
}: Props) {
  const [tab, setTab] = useState<Tab>("overview");
  const [statusFilter, setStatusFilter] = useState<ReviewerStatus | "all">(
    "all",
  );

  const tabs: { value: Tab; label: string }[] = [
    { value: "overview", label: "Overview" },
    { value: "individual", label: "Individual invitations" },
    { value: "general", label: "General invitation link" },
    { value: "reviewers", label: `Reviewers (${reviewers.length})` },
  ];

  function showReviewers(status: ReviewerStatus | "all") {
    setStatusFilter(status);
    setTab("reviewers");
  }

  // Tabs are hidden rather than unmounted, so that edits (e.g., to the email
  // template) are kept when switching tabs
  return (
    <div className="whitespace-normal">
      <div role="tablist" className="flex flex-wrap gap-6 border-b">
        {tabs.map((t) => (
          <button
            key={t.value}
            role="tab"
            aria-selected={tab === t.value}
            onClick={() => setTab(t.value)}
            className={`-mb-px py-3 border-b-2 font-bold transition-colors ${
              tab === t.value
                ? "border-primary text-primary"
                : "border-transparent text-foreground/60 hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="pt-8">
        <div className={tab === "overview" ? "" : "hidden"}>
          <Overview
            goTo={setTab}
            reviewers={reviewers}
            showReviewers={showReviewers}
          />
        </div>
        <div className={tab === "individual" ? "" : "hidden"}>
          <IndividualInvitations
            projectId={projectId}
            division={division}
            deadline={deadline}
            reviewers={reviewers}
            mutateReviewers={mutateReviewers}
          />
        </div>
        <div className={tab === "general" ? "" : "hidden"}>
          <GeneralInvitationLink
            projectId={projectId}
            division={division}
            deadline={deadline}
            joinToken={joinToken}
            reviewers={reviewers}
            submissions={submissions}
            mutateProject={mutateProject}
          />
        </div>
        <div className={tab === "reviewers" ? "" : "hidden"}>
          <ReviewerList
            reviewers={reviewers}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
          />
        </div>
      </div>
    </div>
  );
}

function countStatuses(reviewers: GetReviewer[]) {
  const counts: Record<ReviewerStatus, number> = {
    notInvited: 0,
    invited: 0,
    selfRegistered: 0,
    done: 0,
  };
  for (const r of reviewers) counts[reviewerStatus(r)]++;
  return counts;
}

/** Two column layout used by both invitation tabs: email text on the left, actions on the right */
function TwoColumns({
  left,
  right,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr),24rem] gap-6 items-start">
      <div className="flex flex-col gap-3 min-w-0">{left}</div>
      <div className="flex flex-col gap-4">{right}</div>
    </div>
  );
}

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className={cardStyle}>
      <h4 className="m-0">{title}</h4>
      {children}
    </section>
  );
}

const cardStyle =
  "border rounded-lg p-5 bg-background shadow-sm flex flex-col gap-3";

interface OverviewProps {
  goTo: (tab: Tab) => void;
  reviewers: GetReviewer[];
  showReviewers: (status: ReviewerStatus | "all") => void;
}

function Overview({ goTo, reviewers, showReviewers }: OverviewProps) {
  const counts = useMemo(() => countStatuses(reviewers), [reviewers]);

  return (
    <div className="flex flex-col gap-8">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(Object.keys(statusLabels) as ReviewerStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => showReviewers(status)}
            className="border rounded-lg p-4 bg-background shadow-sm text-left hover:border-primary transition-colors"
          >
            <div className="text-3xl font-bold">{counts[status]}</div>
            <span
              className={`inline-block mt-1 text-sm rounded px-2 py-0.5 ${statusColors[status]}`}
            >
              {statusLabels[status]}
            </span>
          </button>
        ))}
      </div>

      <p className="m-0">
        There are two ways to invite reviewers to the paper bidding. You can use
        either, or both.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className={cardStyle}>
          <h4 className="m-0">Individual invitations</h4>
          <p className="m-0 text-sm">
            We email every registered reviewer a personal link straight to their
            bidding page.
          </p>
          <ul className="text-sm list-disc pl-5 m-0 flex flex-col gap-1">
            <li>
              <b>+</b> Guarantees that reviewers bid with the same email address
              as in the ICA system
            </li>
            <li>
              <b>+</b> No sign-in needed
            </li>
            <li>
              <b>−</b> Only reaches people that are in the uploaded reviewer
              list
            </li>
            <li>
              <b>−</b> Emails sent by this website might end up in spam
            </li>
          </ul>
          <Button
            variant="outline"
            className="mt-auto w-fit"
            onClick={() => goTo("individual")}
          >
            Send individual invitations
          </Button>
        </div>

        <div className={cardStyle}>
          <h4 className="m-0">General invitation link</h4>
          <p className="m-0 text-sm">
            One link that you share yourself, via any outreach to your division
            (The Link, mailing lists, or a mass email from your own account).
          </p>
          <ul className="text-sm list-disc pl-5 m-0 flex flex-col gap-1">
            <li>
              <b>+</b> Sent through channels that people trust, so less likely
              to end up in spam
            </li>
            <li>
              <b>+</b> Also works for members that are not yet registered as
              reviewers, so you can use it to recruit volunteers
            </li>
            <li>
              <b>−</b> People sign in with an emailed code, and need to use the
              same email address as in the ICA system
            </li>
          </ul>
          <Button
            variant="outline"
            className="mt-auto w-fit"
            onClick={() => goTo("general")}
          >
            Get the general invitation link
          </Button>
        </div>

      </div>

      <div className="flex flex-col gap-2">
        <h4 className="m-0 text-base">Recommendation</h4>
        <p className="m-0 text-sm">
          Send the individual invitations to everyone in the reviewer list, and send the general invitation link to your division&apos;s mailing list (or The Link, or whatever).
          There is also a button for getting the email addresses of all (first)authors of your division submissions, so you can easily send the general invitation link to them.
          Here you can also exclude the people in the reviewer list, so that they don&apos;t get two emails.
        </p>
      </div>
    </div>
  );
}

// INDIVIDUAL INVITATIONS

interface IndividualInvitationsProps {
  projectId: number;
  division: string;
  deadline: string;
  reviewers: GetReviewer[];
  mutateReviewers: () => void;
}

function IndividualInvitations({
  projectId,
  division,
  deadline,
  reviewers,
  mutateReviewers,
}: IndividualInvitationsProps) {
  const [text1, setText1] = useState(getText1Default(division));
  const [text2, setText2] = useState(getText2Default(deadline));

  useEffect(() => {
    setText1(getText1Default(division));
  }, [division]);
  useEffect(() => {
    setText2(getText2Default(deadline));
  }, [deadline]);

  return (
    <div className="flex flex-col gap-10">
      <TwoColumns
        left={
          <>
            <h4 className="m-0">Email template</h4>
            <p className="m-0 text-sm">
              Every reviewer receives this email with a personal link to their
              bidding page. You can customize the intro and outro.
            </p>
            <Textarea
              name="intro"
              value={text1}
              onChange={(e) => setText1(e.target.value)}
              rows={10}
            />
            <p className="text-sm font-bold m-0 px-3">
              Please use{" "}
              <span className="text-blue-800 underline">
                this link right here
              </span>{" "}
              to start the paper bidding
            </p>
            <Textarea
              value={text2}
              onChange={(e) => setText2(e.target.value)}
              rows={6}
            />
          </>
        }
        right={
          <>
            <Card title="Send test email">
              <SendTestEmail
                projectId={projectId}
                reviewers={reviewers}
                text1={text1}
                text2={text2}
                division={division}
              />
            </Card>
            <Card title="Send invitations">
              <SendBulkEmail
                projectId={projectId}
                reviewers={reviewers}
                text1={text1}
                text2={text2}
                division={division}
                mutateReviewers={mutateReviewers}
              />
            </Card>
            <Card title="Send reminders">
              <ReviewerEmails reviewers={reviewers} />
            </Card>
          </>
        }
      />
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
    // the test email links to a test page instead of a real bidding page
    const link = reviewers[0]?.link || `${window.location.origin}/bidding/`;
    sendInvitation(projectId, email, link, text1, text2, division, true)
      .then((success) => {
        if (success) alert("Email sent!");
        else alert("Something went wrong, email not sent");
        setEmail("");
      })
      .finally(() => setSending(false));
  }

  if (sending) return <Loading msg={`Sending test email`} />;

  return (
    <form className="flex flex-col gap-2" onSubmit={onSubmit}>
      <p className="m-0 text-sm">
        See what the email looks like (and whether it ends up in spam).
      </p>
      <Input
        type="email"
        name="email"
        placeholder="your email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
      />
      <Button disabled={sending || !email}>Send test email</Button>
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

/** Sends invitations to reviewers that have not been invited yet. To contact
 *  people again (e.g., a reminder), admins can copy the email addresses and
 *  email them themselves, which is less likely to end up in spam */
function SendBulkEmail({
  projectId,
  reviewers,
  text1,
  text2,
  division,
  mutateReviewers,
}: SendBulkEmailProps) {
  const [recipients, setRecipients] = useState<GetReviewer[]>([]);
  const [progress, setProgress] = useState<number | null>(null);

  const uninvited = useMemo(() => {
    return reviewers.filter((r) => reviewerStatus(r) === "notInvited");
  }, [reviewers]);

  function start() {
    const ok = confirm(
      `Send the invitation email to ${uninvited.length} reviewers that have not yet been invited?`,
    );
    if (!ok) return;
    setRecipients(uninvited);
    setProgress(0);
  }

  function cancel(e: React.MouseEvent<HTMLButtonElement, MouseEvent>) {
    e.preventDefault();
    mutateReviewers();
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
          `Something went wrong. Only ${progress} emails were sent. You can just try again: emails are only sent to reviewers that have not been invited yet.`,
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
    text1,
    text2,
    division,
  ]);

  if (progress !== null) {
    return (
      <div className="flex flex-col gap-2">
        <h3 className="text-center m-0">
          {Math.min(progress + 1, recipients.length)} / {recipients.length}
        </h3>
        <span className="italic text-center break-all">
          {recipients[progress]?.email}
        </span>
        <Button onClick={cancel} variant="destructive" className="w-full">
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-sm">
        Emails are only sent to reviewers that have not been invited yet.
      </p>
      <Button disabled={uninvited.length === 0} onClick={start}>
        {uninvited.length === 0
          ? "Everyone has been invited"
          : `Send to ${uninvited.length} not yet invited reviewers`}
      </Button>
    </div>
  );
}

function ReviewerEmails({ reviewers }: { reviewers: GetReviewer[] }) {
  const emails = useMemo(() => {
    return reviewers
      .filter((r) => reviewerStatus(r) === 'invited')
      .map((r) => r.email);
  }, [reviewers]);

  return (
    <div className="flex flex-col gap-3">
      <p className="m-0 text-sm">
        If you want to remind people, you can copy the email addresses below and email them yourself (which is  less likely to end up in spam).
      </p>
      <div className="text-sm font-bold">Invited reviewers that have not bid yet</div>
      <EmailList emails={emails} filename="reviewer_emails" />
    </div>
  );
}

interface ReviewerListProps {
  reviewers: GetReviewer[];
  statusFilter: ReviewerStatus | "all";
  setStatusFilter: (status: ReviewerStatus | "all") => void;
}

function ReviewerList({
  reviewers,
  statusFilter,
  setStatusFilter,
}: ReviewerListProps) {
  const [search, setSearch] = useState("");
  const counts = useMemo(() => countStatuses(reviewers), [reviewers]);

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reviewers.filter(
      (r) =>
        (statusFilter === "all" || reviewerStatus(r) === statusFilter) &&
        (!q || r.email.toLowerCase().includes(q)),
    );
  }, [reviewers, statusFilter, search]);

  const filters: { value: ReviewerStatus | "all"; label: string; n: number }[] =
    [
      { value: "all", label: "All", n: reviewers.length },
      ...(Object.keys(statusLabels) as ReviewerStatus[]).map((status) => ({
        value: status,
        label: statusLabels[status],
        n: counts[status],
      })),
    ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex flex-wrap gap-2">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`rounded-full border px-3 py-1 text-sm transition-colors ${
                statusFilter === f.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background hover:border-primary"
              }`}
            >
              {f.label} <span className="opacity-70">({f.n})</span>
            </button>
          ))}
        </div>
        <Input
          className="max-w-xs"
          placeholder="Search email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="border rounded-lg shadow-sm bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Student</TableHead>
              <TableHead className="text-right">Bids</TableHead>
              <TableHead className="text-right">Bidding page</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((reviewer) => {
              const status = reviewerStatus(reviewer);
              return (
                <TableRow key={reviewer.email}>
                  <TableCell className="max-w-[20rem] truncate py-2">
                    <span title={reviewer.email}>{reviewer.email}</span>
                  </TableCell>
                  <TableCell className="py-2">
                    <span
                      className={`rounded px-2 py-0.5 whitespace-nowrap ${statusColors[status]}`}
                      title={
                        status === "invited" && reviewer.invitationSent
                          ? `Invited on ${new Date(reviewer.invitationSent).toDateString()}`
                          : undefined
                      }
                    >
                      {statusLabels[status]}
                    </span>
                  </TableCell>
                  <TableCell className="py-2">
                    {reviewer.student ? "yes" : "no"}
                  </TableCell>
                  <TableCell className="text-right py-2">
                    {reviewer.biddings?.length ?? 0}
                  </TableCell>
                  <TableCell className="text-right py-2">
                    <a
                      href={reviewer.link}
                      title="Open this reviewer's bidding page"
                      className="inline-flex text-primary hover:opacity-70"
                    >
                      <FaEye size={18} />
                    </a>
                  </TableCell>
                </TableRow>
              );
            })}
            {shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center opacity-70">
                  No reviewers
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// GENERAL INVITATION LINK

interface GeneralInvitationLinkProps {
  projectId: number;
  division: string;
  deadline: string;
  joinToken: string;
  reviewers: GetReviewer[];
  submissions: GetMetaSubmission[];
  mutateProject: () => void;
}

function GeneralInvitationLink({
  projectId,
  division,
  deadline,
  joinToken,
  reviewers,
  submissions,
  mutateProject,
}: GeneralInvitationLinkProps) {
  const { trigger: regenerate } = useRegenerateJoinToken(projectId);
  const [copied, setCopied] = useState("");
  const [link, setLink] = useState("");

  // window is only available client side
  useEffect(() => {
    setLink(`${window.location.origin}/join/${projectId}/${joinToken}`);
  }, [projectId, joinToken]);

  const [emailText, setEmailText] = useState("");
  useEffect(() => {
    setEmailText(getGeneralInvitationText(division, deadline, link));
  }, [division, deadline, link]);

  function copy(what: "link" | "email", text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(what);
      setTimeout(() => setCopied(""), 2000);
    });
  }

  function onRegenerate() {
    const ok = confirm(
      "Are you sure? The current general invitation link will stop working. Reviewers that already joined can still use their personal bidding link.",
    );
    if (!ok) return;
    regenerate({}).then(() => mutateProject());
  }

  return (
    <TwoColumns
      left={
        <>
          <h4 className="m-0">Suggested email text</h4>
          <p className="m-0 text-sm">
            Share the link via your own channels, such as The Link, mailing
            lists, or a mass email from your own account. You can use (and edit)
            this text.
          </p>
          <Textarea
            value={emailText}
            onChange={(e) => setEmailText(e.target.value)}
            rows={20}
          />
          <Button
            size="sm"
            className="w-fit"
            onClick={() => copy("email", emailText)}
          >
            {copied === "email" ? "Copied!" : "Copy email text"}
          </Button>
        </>
      }
      right={
        <>
          <Card title="General invitation link">
            <p className="text-sm m-0">
              Anyone with this link can sign in with their email address. If the
              email is in the reviewer list, they go straight to their bidding
              page. If not, they are asked to check whether they used the right email address,
              or else to register as a reviewer in the ICA submission system and indicate
              your division as their expertise (you need to have set the registration link in your project settings).
            </p>
            <code className="bg-background border rounded px-2 py-1 text-sm break-all">
              {link}
            </code>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => copy("link", link)}>
                {copied === "link" ? "Copied!" : "Copy link"}
              </Button>
              <Button size="sm" variant="outline" onClick={onRegenerate}>
                Regenerate
              </Button>
            </div>
          </Card>
          <Card title="Email addresses of authors">
            <AuthorEmails reviewers={reviewers} submissions={submissions} />
          </Card>
        </>
      }
    />
  );
}

interface AuthorEmailsProps {
  reviewers: GetReviewer[];
  submissions: GetMetaSubmission[];
}

/** Lists author email addresses, for sending the general invitation via
 *  your own channels. We don't send anything to these addresses ourselves. */
function AuthorEmails({ reviewers, submissions }: AuthorEmailsProps) {
  const [firstOnly, setFirstOnly] = useState("all");
  const [includeReviewers, setIncludeReviewers] = useState("no");

  const emails = useMemo(() => {
    const reviewerEmails = new Set(
      reviewers.map((r) => r.email.trim().toLowerCase()),
    );
    const seen = new Set<string>();
    const result: string[] = [];
    for (const submission of submissions) {
      const authors =
        firstOnly === "first"
          ? submission.authors.slice(0, 1)
          : submission.authors;
      for (const author of authors) {
        const email = author.trim();
        const key = email.toLowerCase();
        if (!email.includes("@") || seen.has(key)) continue;
        if (includeReviewers === "no" && reviewerEmails.has(key)) continue;
        seen.add(key);
        result.push(email);
      }
    }
    return result.sort((a, b) => a.localeCompare(b));
  }, [reviewers, submissions, firstOnly, includeReviewers]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm m-0">
        The authors of your division&apos;s submissions, for example to send
        them the general invitation from your own account. This website does not
        email these people.
      </p>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold">Authors</span>
        <RadioGroup
          orientation="horizontal"
          className="flex gap-4"
          value={firstOnly}
          onValueChange={setFirstOnly}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="all" id="authors-all" />
            <Label htmlFor="authors-all">All authors</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="first" id="authors-first" />
            <Label htmlFor="authors-first">Only first authors</Label>
          </div>
        </RadioGroup>
      </div>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-bold">
          Include people in the reviewer list
        </span>
        <RadioGroup
          orientation="horizontal"
          className="flex gap-4"
          value={includeReviewers}
          onValueChange={setIncludeReviewers}
        >
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="no" id="reviewers-no" />
            <Label htmlFor="reviewers-no">No</Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="yes" id="reviewers-yes" />
            <Label htmlFor="reviewers-yes">Yes</Label>
          </div>
        </RadioGroup>
      </div>
      <EmailList emails={emails} filename="author_emails" />
    </div>
  );
}

/** Shows a list of email addresses on request, with copy and download buttons */
function EmailList({
  emails,
  filename,
}: {
  emails: string[];
  filename: string;
}) {
  const [copied, setCopied] = useState(false);
  const { CSVDownloader, Type } = useCSVDownloader();

  function copy() {
    navigator.clipboard.writeText(emails.join(", ")).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <Textarea
        className="bg-background"
        value={emails.join("\n")}
        readOnly
        rows={6}
      />
      <span className="text-sm font-bold">{emails.length} email addresses</span>
      <div className="flex flex-wrap gap-2">
        <Button size="sm" onClick={copy} disabled={!emails.length}>
          {copied ? "Copied!" : "Copy (comma separated)"}
        </Button>
        <CSVDownloader
          type={Type.Link}
          filename={filename}
          bom={true}
          data={emails.map((email) => ({ email }))}
        >
          <Button size="sm" variant="outline" disabled={!emails.length}>
            Download CSV
          </Button>
        </CSVDownloader>
      </div>
    </div>
  );
}

function getGeneralInvitationText(
  division: string,
  deadline: string,
  link: string,
) {
  return `Dear member of the ${division} division,

The ICA submissions are in, and it's time to review!

To help us assign the right reviewers to the right papers, we ask you to indicate which papers match your expertise and interest. Please visit the following link, where you will see the abstracts sorted by similarity to your own work:

${link}

You will be asked to sign in with your email address. Please use the same email address that you use in the ICA system, so that we can match you to your reviewer profile. You will receive an email with a sign-in code from paperbidding@ica-cm.com. If you don't see it within a few minutes, please check your spam folder.

The deadline for indicating your preferences is ${deadline}, so please act quickly if you want to bid. If you do not bid on any papers, you will automatically be matched to remaining papers based on similarity to your own submissions.

Happy bidding!`;
}

function getText1Default(division: string) {
  return `Dear member of the ${division} division,

The ICA submissions are in, and it's time to review!

To help us assign the right reviewers to the right papers, we ask you to indicate which papers match your expertise and interest. The following link shows you the abstracts sorted by similarity to your own work. Please take a few minutes to indicate which papers you would like to review.

`;
}
function getText2Default(deadline: string) {
  return `The deadline for indicating your preferences is ${deadline}, so please act quickly if you want to bid. If you do not bid on any papers, you will automatically be matched to remaining papers based on similarity to your own submissions.

Happy bidding!`;
}
