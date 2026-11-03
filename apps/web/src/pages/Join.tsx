import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { api, unwrap } from "../api";
import { Button, ErrorText } from "../ui";
import SignIn from "./SignIn";

/** The general join link of a division: sign in, then join as a reviewer */
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

  if (info.error) return <Message title="This link does not work">{info.error.message}</Message>;
  if (!info.data) return null;
  const { conference, division, edition, signedInAs, joined, platformName, registrationUrl, biddingDeadline } =
    info.data;
  const biddingOpen = !!biddingDeadline && new Date(biddingDeadline) > new Date();
  const heading = `${division} · ${edition}`;

  if (!signedInAs)
    return (
      <div>
        <p className="mx-auto mt-12 max-w-sm px-6 text-sm text-slate-600">
          {conference}: join <b>{heading}</b> as a reviewer. First sign in with your email.
        </p>
        <SignIn onSignedIn={() => queryClient.invalidateQueries()} />
      </div>
    );

  const accountNote = (
    <p className="mt-4 rounded border border-amber-300 bg-amber-50 p-3">
      <b>Important:</b> reviews are assigned in {platformName}. Make sure you have an account at{" "}
      <a href={registrationUrl} target="_blank" rel="noreferrer" className="text-blue-800 underline">
        {registrationUrl}
      </a>{" "}
      with this email address (<b>{signedInAs}</b>). Otherwise submissions cannot be assigned to
      you.
    </p>
  );

  if (joined)
    return (
      <Message title={`You are a reviewer for ${heading}`}>
        {biddingOpen ? (
          <>
            <p className="mb-3">
              Paper bidding is open until {new Date(biddingDeadline!).toLocaleString()}.
            </p>
            <Link to={`/bid/${divisionEditionId}`} className="rounded bg-slate-900 px-3 py-1.5 text-white">
              Go to bidding
            </Link>
          </>
        ) : (
          <p>
            You are in the reviewer pool of this division. Paper bidding is not open; you can come
            back to this link when it is.
          </p>
        )}
        {accountNote}
      </Message>
    );

  return (
    <Message title={`Join ${heading} as a reviewer`}>
      <p className="mb-4">
        {conference}. You are signed in as <b>{signedInAs}</b>.
      </p>
      <label className="mb-4 flex items-center gap-2">
        <input type="checkbox" checked={student} onChange={(e) => setStudent(e.target.checked)} />
        I am a student
      </label>
      <Button onClick={() => join.mutate()} disabled={join.isPending}>
        Join as reviewer
      </Button>
      <ErrorText error={join.error} />
      {accountNote}
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
