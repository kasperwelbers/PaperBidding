import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useParams } from "react-router";
import { api, unwrap } from "../api";
import { ErrorText } from "../ui";
import SignIn from "./SignIn";

/** The bidding page. With a personal link (/bid/:id/:reviewerId/:secret) no
 *  sign-in is needed; without (/bid/:id) the signed in user's email is used */
export default function Bidding() {
  const { divisionEditionId, reviewerId, secret } = useParams() as {
    divisionEditionId: string;
    reviewerId?: string;
    secret?: string;
  };
  const queryClient = useQueryClient();
  const headers: Record<string, string> = reviewerId && secret ? { "X-Bidding-Token": `${reviewerId}.${secret}` } : {};
  const param = { divisionEditionId };
  const key = ["bidding", divisionEditionId, reviewerId ?? "session"];

  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      const res = await api.bidding[":divisionEditionId"].$get({ param }, { headers });
      if (res.status === 404 && !reviewerId) return null; // not signed in, or not a reviewer
      return unwrap(Promise.resolve(res));
    },
  });

  const [selection, setSelection] = useState<number[]>([]);
  useEffect(() => {
    if (list.data) setSelection(list.data.bids);
  }, [list.data]);

  const save = useMutation({
    mutationFn: (submissionIds: number[]) =>
      unwrap(api.bidding[":divisionEditionId"].bids.$put({ param, json: { submissionIds } }, { headers })),
  });
  const update = (next: number[]) => {
    setSelection(next);
    save.mutate(next);
  };

  if (list.isLoading) return null;
  if (list.error) return <Page title="Paper bidding"><ErrorText error={list.error} /></Page>;
  if (list.data === null)
    return (
      <div>
        <p className="mx-auto mt-12 max-w-sm px-6 text-sm text-slate-600">
          Sign in with the email address you are a reviewer with. If you are, but this doesn't work, use the link
          from your invitation email.
        </p>
        <SignIn onSignedIn={() => queryClient.invalidateQueries({ queryKey: key })} />
      </div>
    );
  const data = list.data!;
  const title = `${data.division} · ${data.edition}`;
  const deadline = data.deadline ? new Date(data.deadline).toLocaleString() : null;

  if (!data.open)
    return (
      <Page title={title}>
        <p>
          {deadline ? `Bidding closed on ${deadline}.` : "Bidding is not open yet."}
          {data.bids.length > 0 ? ` You bid on ${data.bids.length} submissions.` : ""}
        </p>
      </Page>
    );

  const byId = new Map(data.submissions.map((s) => [s.id, s]));
  const toggle = (id: number) =>
    update(selection.includes(id) ? selection.filter((x) => x !== id) : [...selection, id]);
  const move = (i: number, delta: number) => {
    const next = [...selection];
    const [item] = next.splice(i, 1);
    next.splice(Math.max(0, Math.min(next.length, i + delta)), 0, item!);
    update(next);
  };

  return (
    <Page title={title}>
      <div className="mb-4 rounded bg-slate-100 p-3">
        <p>
          Check the submissions you would like to review. Click a title to read the abstract.
          {data.basedOnOwnWork
            ? " They are sorted by similarity to your own submissions."
            : " We have no submissions of yours to compare with, so they are in random order."}
        </p>
        <p className="mt-1">
          Deadline: <b>{deadline}</b>. Your choices are saved automatically
          {data.email ? ` (as ${data.email})` : ""}.{" "}
          <span className={save.isPending ? "text-slate-500" : "text-green-700"}>
            {save.isPending ? "Saving…" : save.isSuccess ? "Saved." : ""}
          </span>
        </p>
        <ErrorText error={save.error} />
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_18rem]">
        <ul className="flex flex-col divide-y divide-slate-100">
          {data.submissions.map((s) => (
            <SubmissionRow
              key={s.id}
              id={s.id}
              title={s.title}
              checked={selection.includes(s.id)}
              onToggle={() => toggle(s.id)}
              divisionEditionId={divisionEditionId}
              headers={headers}
            />
          ))}
        </ul>
        <aside className="md:sticky md:top-4 md:self-start">
          <h2 className="mb-2 font-semibold">Your selection ({selection.length})</h2>
          {selection.length === 0 ? (
            <p className="text-slate-500">Nothing selected yet.</p>
          ) : (
            <>
              <p className="mb-2 text-xs text-slate-500">Most preferred first.</p>
              <ol className="flex flex-col gap-1">
                {selection.map((id, i) => (
                  <li key={id} className="flex items-start gap-1 text-xs">
                    <span className="w-5 shrink-0 text-slate-500">{i + 1}.</span>
                    <span className="flex-1">{byId.get(id)?.title ?? "?"}</span>
                    <button className="px-1 text-slate-500 hover:text-black" onClick={() => move(i, -1)} title="Up">
                      ↑
                    </button>
                    <button className="px-1 text-slate-500 hover:text-black" onClick={() => move(i, 1)} title="Down">
                      ↓
                    </button>
                    <button className="px-1 text-red-700" onClick={() => toggle(id)} title="Remove">
                      ×
                    </button>
                  </li>
                ))}
              </ol>
            </>
          )}
        </aside>
      </div>
    </Page>
  );
}

function SubmissionRow(props: {
  id: number;
  title: string;
  checked: boolean;
  onToggle: () => void;
  divisionEditionId: string;
  headers: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const abstract = useQuery({
    queryKey: ["abstract", props.divisionEditionId, props.id],
    queryFn: () =>
      unwrap(
        api.bidding[":divisionEditionId"].submissions[":submissionId"].$get(
          { param: { divisionEditionId: props.divisionEditionId, submissionId: String(props.id) } },
          { headers: props.headers },
        ),
      ),
    enabled: open,
  });
  return (
    <li className="flex gap-3 py-2">
      <input type="checkbox" className="mt-1" checked={props.checked} onChange={props.onToggle} />
      <div className="flex-1">
        <button className="text-left font-medium hover:underline" onClick={() => setOpen(!open)}>
          {props.title}
        </button>
        {open ? (
          <p className="mt-1 whitespace-pre-line text-slate-700">{abstract.data?.abstract ?? "Loading…"}</p>
        ) : null}
      </div>
    </li>
  );
}

function Page({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-5xl p-6 text-sm">
      <h1 className="mb-4 text-xl font-bold">Paper bidding: {title}</h1>
      {children}
    </main>
  );
}

