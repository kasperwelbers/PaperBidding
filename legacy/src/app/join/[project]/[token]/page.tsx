"use client";

import { signOut, useSession } from "@/auth/authClient";
import { EmailOtpLogin } from "@/components/EmailOtpLogin";
import { Button } from "@/components/ui/button";
import { Error } from "@/components/ui/error";
import { Label } from "@/components/ui/label";
import { Loading } from "@/components/ui/loading";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useJoinInfo, useJoinProject } from "@/hooks/api";
import { GetJoinInfo } from "@/types";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

export default function JoinPage(props: {
  params: Promise<{ project: string; token: string }>;
}) {
  const params = use(props.params);
  const projectId = Number(params.project);
  const token = params.token;

  const router = useRouter();
  const session = useSession();
  const { data, error, isLoading, mutate } = useJoinInfo(projectId, token);

  const reviewer = data?.reviewer;
  useEffect(() => {
    if (!reviewer) return;
    router.replace(
      `/bidding/${projectId}/${reviewer.reviewerId}/${reviewer.secret}`,
    );
  }, [reviewer, projectId, router]);

  function content() {
    if (error)
      return (
        <Error msg="This invitation link is not valid (anymore). Please check that you copied the full link, or ask the division planner for a new link." />
      );
    if (session.status === "loading" || isLoading || !data)
      return <Loading msg="Loading..." />;
    if (data.reviewer) return <Loading msg="Opening paper bidding..." />;

    if (!data.email)
      return (
        <div className="flex flex-col gap-6 items-center">
          <div className="max-w-md text-center">
            <p className="mt-0">
              To start bidding, please sign in with your email address.
            </p>
            <p className="mb-0">
              <b>Use the same email address that you use in the ICA system</b>,
              so that we can match you to your reviewer profile and your own
              submissions.
            </p>
          </div>
          <EmailOtpLogin callback={() => mutate()} />
        </div>
      );

    return (
      <NotRegistered
        projectId={projectId}
        token={token}
        info={data}
        onJoined={(reviewerId, secret) =>
          router.replace(`/bidding/${projectId}/${reviewerId}/${secret}`)
        }
      />
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center">
      <header className="min-h-[3.5rem] w-full bg-primary flex justify-center">
        <div className="flex px-4 lg:px-10 py-1 max-w-7xl w-full items-center text-white">
          <h5 className="m-0">ICA Paper bidding</h5>
        </div>
      </header>
      <div className="mt-12 px-4 lg:px-10 w-full max-w-3xl flex flex-col gap-8">
        {data ? <ProjectInfo info={data} /> : null}
        {content()}
      </div>
    </main>
  );
}

function ProjectInfo({ info }: { info: GetJoinInfo }) {
  const deadline = new Date(info.project.deadline);
  return (
    <div className="border-b-2 border-primary pb-4 text-center">
      <h2 className="mb-1">{info.project.division}</h2>
      <h4 className="m-0 font-normal">{info.project.name}</h4>
      <p className="mb-0">
        Bidding closes on{" "}
        <span className="italic">{deadline.toDateString()}</span>
      </p>
    </div>
  );
}

interface NotRegisteredProps {
  projectId: number;
  token: string;
  info: GetJoinInfo;
  onJoined: (reviewerId: number, secret: string) => void;
}

function NotRegistered({
  projectId,
  token,
  info,
  onJoined,
}: NotRegisteredProps) {
  const { trigger: join } = useJoinProject(projectId);
  const [student, setStudent] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState("");
  const registrationInfoUrl = info.project.registrationInfoUrl;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setJoining(true);
    setError("");
    try {
      const res = await join({ token, student: student === "yes" });
      if (!res.ok) throw new globalThis.Error(res.statusText);
      const { reviewerId, secret } = await res.json();
      onJoined(reviewerId, secret);
    } catch (e) {
      setError("Something went wrong. Please try again.");
      setJoining(false);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="mt-0">This email is not yet registered as a reviewer</h3>
        <p>
          You are signed in as <b>{info.email}</b>, but this email address is
          not yet registered as an ICA reviewer for the {info.project.division}{" "}
          division this year.
        </p>
        <ul className="list-disc pl-6 flex flex-col gap-2">
          <li>
            <b>Not registered as a reviewer yet?</b> Go to the{" "}
            <a
              href={registrationInfoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary underline break-all"
            >
              ICA submission system
            </a>
            , sign in with this same email address ({info.email}), agree to
            review, and indicate the <b>{info.project.division}</b> division as
            your expertise.
          </li>
          <li>
            <b>Did you sign up with another email address?</b> Then please
            <a href="#" onClick={() => signOut()} className="text-primary underline text-blue-950 ml-1 font-bold">sign-out</a>, and sign in again with that address.
          </li>
        </ul>
      </div>

      <form
        className="flex flex-col gap-4 border rounded p-4 bg-secondary"
        onSubmit={onSubmit}
      >
        <div>
          <h4 className="mt-0 mb-1">Continue as volunteer reviewer</h4>
          <p className="m-0 text-sm">
            You can already bid on papers now. Please answer the question below
            to continue.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <span className="font-bold">Are you a student?</span>
          <RadioGroup
            orientation="horizontal"
            className="flex gap-6"
            value={student}
            onValueChange={setStudent}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="yes" id="student-yes" />
              <Label htmlFor="student-yes">Yes</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="no" id="student-no" />
              <Label htmlFor="student-no">No</Label>
            </div>
          </RadioGroup>
        </div>
        <Button disabled={!student || joining} className="w-fit">
          {joining ? "Joining..." : "Continue as volunteer reviewer"}
        </Button>
        {error ? <p className="text-destructive text-sm m-0">{error}</p> : null}
      </form>
    </div>
  );
}
