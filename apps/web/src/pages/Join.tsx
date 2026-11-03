import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Navigate, useParams } from "react-router";
import { api, unwrap } from "../api";
import { authClient } from "../auth";
import { Button, ErrorText } from "../ui";
import SignIn from "./SignIn";

/** The division link, shared by planners through their own channels.
 *  Reviewers sign in and go to bidding. Unknown addresses get a warning first
 *  (most likely the wrong address), and can then join as a new reviewer */
export default function Join() {
  const { divisionEditionId, token } = useParams() as { divisionEditionId: string; token: string };
  const queryClient = useQueryClient();
  const [student, setStudent] = useState(false);
  const key = ["join", divisionEditionId, token];
  const info = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.join[":divisionEditionId"].$get({ param: { divisionEditionId }, query: { token } })),
  });
  const join = useMutation({
    mutationFn: () =>
      unwrap(api.join[":divisionEditionId"].$post({ param: { divisionEditionId }, json: { token, student } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const switchAccount = async () => {
    await authClient.signOut();
    queryClient.clear();
    await queryClient.invalidateQueries({ queryKey: key });
  };

  if (info.error) return <Message title="This link does not work">{info.error.message}</Message>;
  if (!info.data) return null;
  const { conference, division, edition, signedInAs, joined, excluded, platformName, registrationUrl, biddingDeadline } =
    info.data;
  const biddingOpen = !!biddingDeadline && new Date(biddingDeadline) > new Date();
  const heading = `${division} · ${edition}`;
  const title = biddingOpen ? `Paper bidding: ${heading}` : `Reviewing for ${heading}`;

  const useRightAddress = (
    <p className="rounded border-2 border-amber-400 bg-amber-50 p-3">
      <b>Sign in with the email address of your {platformName} account</b>, so we can match you to
      your reviewer profile. Reviews are assigned in {platformName}.
    </p>
  );

  if (!signedInAs)
    return (
      <div>
        <div className="mx-auto mt-12 flex max-w-sm flex-col gap-3 px-6 text-sm">
          <h1 className="text-xl font-bold">{title}</h1>
          <p className="text-slate-600">{conference}</p>
          {useRightAddress}
        </div>
        <SignIn onSignedIn={() => queryClient.invalidateQueries({ queryKey: key })} />
      </div>
    );

  if (joined) {
    if (biddingOpen) return <Navigate to={`/bid/${divisionEditionId}`} replace />;
    return (
      <Message title={title}>
        <p>
          You are a reviewer for this division ({signedInAs}). Paper bidding is not open; you can
          come back to this link when it is.
        </p>
      </Message>
    );
  }

  if (excluded)
    return (
      <Message title={title}>
        <p className="mb-4">
          The planners of this division took <b>{signedInAs}</b> out of its reviewers. If you think
          that's a mistake, contact them.
        </p>
        <Button variant="ghost" onClick={switchAccount}>
          Sign in with another address
        </Button>
      </Message>
    );

  return (
    <Message title={title}>
      <div className="flex flex-col gap-4">
        <div className="rounded border-2 border-amber-400 bg-amber-50 p-3">
          <p className="mb-2">
            We don't know <b>{signedInAs}</b> as a reviewer for this division. Did you sign in with
            the email address of your {platformName} account?
          </p>
          <Button onClick={switchAccount}>Sign in with another address</Button>
        </div>
        <div className="rounded border border-slate-200 p-3">
          <p className="mb-2 font-medium">New reviewer for this division?</p>
          <p className="mb-3 text-slate-600">
            Then you can join with this address. You need an account at{" "}
            <a href={registrationUrl} target="_blank" rel="noreferrer" className="text-blue-800 underline">
              {registrationUrl}
            </a>{" "}
            with <b>{signedInAs}</b>, otherwise submissions cannot be assigned to you.
          </p>
          <label className="mb-3 flex items-center gap-2">
            <input type="checkbox" checked={student} onChange={(e) => setStudent(e.target.checked)} />
            I am a student
          </label>
          <Button variant="ghost" className="border border-slate-300" onClick={() => join.mutate()} disabled={join.isPending}>
            Join as a new reviewer
          </Button>
          <ErrorText error={join.error} />
        </div>
        <p className="text-xs text-slate-500">{conference}</p>
      </div>
    </Message>
  );
}

function Message({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto mt-24 max-w-md p-6 text-sm">
      <h1 className="mb-3 text-xl font-bold">{title}</h1>
      <div>{children}</div>
    </main>
  );
}
