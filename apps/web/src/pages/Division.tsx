import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { api, unwrap } from "../api";
import { Button, Card, ErrorText, Input } from "../ui";
import { ImportForm } from "./Edition";

type Params = { conferenceId: string; editionId: string; divisionId: string };

const divisionApi = () => api.conferences[":conferenceId"].editions[":editionId"].divisions[":divisionId"];

export default function Division() {
  const param = useParams() as Params;
  const { conferenceId, editionId, divisionId } = param;
  const info = useQuery({
    queryKey: ["division", editionId, divisionId],
    queryFn: () => unwrap(divisionApi().$get({ param })),
  });

  if (info.error) return <ErrorText error={info.error} />;
  if (!info.data) return <p className="text-sm text-slate-500">Loading…</p>;
  const { canEdit } = info.data;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          to={`/conferences/${conferenceId}/editions/${editionId}`}
          className="text-sm text-blue-800 hover:underline"
        >
          ← {info.data.edition.name}
        </Link>
        <h1 className="text-2xl font-bold">{info.data.division.name}</h1>
        {!canEdit ? (
          <p className="text-sm text-slate-600">You can view this division, but only its planners can change it.</p>
        ) : null}
      </div>
      {canEdit && info.data.joinToken ? (
        <JoinLink param={param} divisionEditionId={info.data.divisionEditionId} token={info.data.joinToken} />
      ) : null}
      <BiddingCard param={param} canEdit={canEdit} deadline={info.data.biddingDeadline} />
      <References param={param} canEdit={canEdit} sources={info.data.referenceSources} />
      <Reviewers param={param} canEdit={canEdit} />
      <Submissions param={param} />
    </div>
  );
}

function JoinLink({ param, divisionEditionId, token }: { param: Params; divisionEditionId: number; token: string }) {
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const url = `${window.location.origin}/join/${divisionEditionId}/${token}`;
  const regenerate = useMutation({
    mutationFn: () => unwrap(divisionApi()["join-token"].$post({ param })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["division", param.editionId, param.divisionId] }),
  });
  return (
    <Card title="Join link">
      <p className="mb-2 text-sm">
        Anyone with this link can sign in and join this division as a reviewer, e.g. volunteers
        that are not in the reviewer list.
      </p>
      <div className="flex gap-2">
        <Input readOnly value={url} className="flex-1 font-mono text-xs" onFocus={(e) => e.target.select()} />
        <Button
          onClick={() => {
            navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        >
          {copied ? "Copied" : "Copy"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            if (confirm("Make a new link? The current link stops working.")) regenerate.mutate();
          }}
        >
          New link
        </Button>
      </div>
      <ErrorText error={regenerate.error} />
    </Card>
  );
}

function References({
  param,
  canEdit,
  sources,
}: {
  param: Params;
  canEdit: boolean;
  sources: { divisionIds: number[]; editionIds: number[] };
}) {
  const queryClient = useQueryClient();
  const divisions = useQuery({
    queryKey: ["conference", param.conferenceId, "divisions"],
    queryFn: () =>
      unwrap(api.conferences[":conferenceId"].divisions.$get({ param: { conferenceId: param.conferenceId } })),
  });
  const editions = useQuery({
    queryKey: ["conference", param.conferenceId, "editions"],
    queryFn: () =>
      unwrap(api.conferences[":conferenceId"].editions.$get({ param: { conferenceId: param.conferenceId } })),
  });
  const save = useMutation({
    mutationFn: (referenceSources: typeof sources) =>
      unwrap(divisionApi().$patch({ param, json: { referenceSources } })),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["division", param.editionId, param.divisionId] });
      queryClient.invalidateQueries({ queryKey: ["division", param.editionId, param.divisionId, "reviewers"] });
    },
  });
  const toggle = (key: "divisionIds" | "editionIds", id: number, on: boolean) =>
    save.mutate({ ...sources, [key]: on ? [...sources[key], id] : sources[key].filter((x) => x !== id) });

  const otherDivisions = divisions.data?.filter((d) => String(d.id) !== param.divisionId) ?? [];
  const otherEditions = editions.data?.filter((e) => String(e.id) !== param.editionId) ?? [];

  return (
    <Card title="Reference submissions">
      <ErrorText error={save.error} />
      <p className="mb-3 text-sm">
        Reviewers are matched to submissions by similarity to their own work: their submissions
        in this division, and in the sources selected here. More sources help reviewers who did
        not submit to this division.
      </p>
      <div className="grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <p className="mb-1 font-medium">Other divisions (this edition)</p>
          {otherDivisions.map((d) => (
            <label key={d.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!canEdit || save.isPending}
                checked={sources.divisionIds.includes(d.id)}
                onChange={(e) => toggle("divisionIds", d.id, e.target.checked)}
              />
              {d.name}
            </label>
          ))}
        </div>
        <div>
          <p className="mb-1 font-medium">Other editions (all divisions)</p>
          {otherEditions.length === 0 ? <p className="text-slate-500">No other editions</p> : null}
          {otherEditions.map((e) => (
            <label key={e.id} className="flex items-center gap-2">
              <input
                type="checkbox"
                disabled={!canEdit || save.isPending}
                checked={sources.editionIds.includes(e.id)}
                onChange={(ev) => toggle("editionIds", e.id, ev.target.checked)}
              />
              {e.name}
            </label>
          ))}
        </div>
      </div>
    </Card>
  );
}

const sourceLabels: Record<string, string> = {
  keyword: "keyword",
  planner: "added by planner",
  join_link: "join link",
};

function Reviewers({ param, canEdit }: { param: Params; canEdit: boolean }) {
  const queryClient = useQueryClient();
  const key = ["division", param.editionId, param.divisionId, "reviewers"];
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const [email, setEmail] = useState("");
  const [showExcluded, setShowExcluded] = useState(false);
  const [importing, setImporting] = useState(false);

  const reviewers = useQuery({ queryKey: key, queryFn: () => unwrap(divisionApi().reviewers.$get({ param })) });
  const specs = useQuery({
    queryKey: ["edition", param.editionId, "import-specs"],
    queryFn: () =>
      unwrap(
        api.conferences[":conferenceId"].editions[":editionId"].imports.specs.$get({
          param: { conferenceId: param.conferenceId, editionId: param.editionId },
        }),
      ),
    enabled: canEdit,
  });
  const add = useMutation({
    mutationFn: () => unwrap(divisionApi().reviewers.$post({ param, json: { email } })),
    onSuccess: () => {
      setEmail("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (reviewerId: number) =>
      unwrap(divisionApi().reviewers[":reviewerId"].$delete({ param: { ...param, reviewerId: String(reviewerId) } })),
    onSuccess: refresh,
  });
  const include = useMutation({
    mutationFn: (reviewerId: number) =>
      unwrap(
        divisionApi().reviewers[":reviewerId"].include.$post({ param: { ...param, reviewerId: String(reviewerId) } }),
      ),
    onSuccess: refresh,
  });

  const all = reviewers.data ?? [];
  const active = all.filter((r) => !r.excluded);
  const excluded = all.filter((r) => r.excluded);
  const shown = showExcluded ? excluded : active;
  const noBasis = active.filter((r) => r.ownSubmissions === 0).length;
  const spec = specs.data?.find((s) => s.kind === "reviewers");

  return (
    <Card title={`Reviewers (${active.length})`}>
      <ErrorText error={reviewers.error || add.error || remove.error || include.error} />
      <p className="mb-3 text-sm text-slate-600">
        Reviewers who picked a keyword of this division, were added here, or joined with the join
        link.
        {noBasis > 0 ? (
          <span className="text-amber-800">
            {" "}
            {noBasis} have no own submissions in the reference sources, so they can only be
            matched through bidding.
          </span>
        ) : null}
      </p>
      {excluded.length > 0 ? (
        <Button variant="ghost" className="mb-2" onClick={() => setShowExcluded(!showExcluded)}>
          {showExcluded ? "Show the pool" : `Show ${excluded.length} taken out of this division`}
        </Button>
      ) : null}
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs text-slate-500">
            <tr>
              <th className="font-normal">Reviewer</th>
              <th className="font-normal">Via</th>
              <th className="font-normal" title="Number of divisions this reviewer is in">
                Divisions
              </th>
              <th className="font-normal" title="Own submissions in the reference sources">
                Own subm.
              </th>
              <th className="font-normal">Bids</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.reviewerId} className="border-t border-slate-100 align-top">
                <td className="py-1">
                  <div>
                    {r.emails[0] ?? "?"}
                    {r.student ? <span className="ml-1 text-xs text-slate-500">student</span> : null}
                    {!r.canReview ? <span className="ml-1 text-xs text-red-700">not willing</span> : null}
                  </div>
                  <div className="text-xs text-slate-500">
                    {[r.name, r.institution, r.platformId ? `ID ${r.platformId}` : "no Person ID"]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </td>
                <td className="text-xs">{r.sources.map((s) => sourceLabels[s] ?? s).join(", ")}</td>
                <td className={r.divisions >= 3 ? "font-bold text-amber-800" : ""}>{r.divisions}</td>
                <td className={r.ownSubmissions === 0 ? "text-amber-800" : ""}>{r.ownSubmissions}</td>
                <td className="text-xs">
                  {r.bids > 0 ? r.bids : r.invitedAt ? <span className="text-slate-500">invited</span> : "–"}
                </td>
                <td className="text-right">
                  {canEdit ? (
                    r.excluded ? (
                      <Button variant="ghost" onClick={() => include.mutate(r.reviewerId)}>
                        Put back
                      </Button>
                    ) : (
                      <Button variant="danger" onClick={() => remove.mutate(r.reviewerId)}>
                        {r.sources.includes("keyword") ? "Take out" : "Remove"}
                      </Button>
                    )
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <div className="mt-4 flex flex-col gap-3">
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              add.mutate();
            }}
          >
            <Input
              type="email"
              required
              placeholder="Add a reviewer by email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button disabled={add.isPending}>Add</Button>
          </form>
          {spec ? (
            importing ? (
              <div className="rounded border border-slate-200 p-3">
                <p className="mb-2 text-sm font-medium">Import your own reviewer list for this division</p>
                <ImportForm
                  conferenceId={param.conferenceId}
                  editionId={param.editionId}
                  spec={spec}
                  divisionId={param.divisionId}
                  onStarted={() => {
                    setImporting(false);
                    setTimeout(refresh, 3000);
                  }}
                />
              </div>
            ) : (
              <Button variant="ghost" onClick={() => setImporting(true)}>
                Import a reviewer list for this division
              </Button>
            )
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function Submissions({ param }: { param: Params }) {
  const submissions = useQuery({
    queryKey: ["division", param.editionId, param.divisionId, "submissions"],
    queryFn: () => unwrap(divisionApi().submissions.$get({ param })),
  });
  const [open, setOpen] = useState(false);
  const all = submissions.data ?? [];
  return (
    <Card title={`Submissions (${all.length})`}>
      <ErrorText error={submissions.error} />
      {all.length === 0 ? (
        <p className="text-sm text-slate-600">No submissions in this division yet.</p>
      ) : (
        <>
          <Button variant="ghost" onClick={() => setOpen(!open)}>
            {open ? "Hide" : "Show"} submissions
          </Button>
          {open ? (
            <ul className="mt-2 flex max-h-[32rem] flex-col divide-y divide-slate-100 overflow-auto text-sm">
              {all.map((s) => (
                <li key={s.id} className="py-1">
                  <span className="mr-2 font-mono text-xs text-slate-500">{s.externalId}</span>
                  {s.title}
                  <div className="text-xs text-slate-500">
                    {s.authors.map((a) => a.name || a.email).join(", ")}
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </Card>
  );
}

/** Paper bidding is optional: without a deadline, matching uses similarity only */
function BiddingCard({
  param,
  canEdit,
  deadline,
}: {
  param: Params;
  canEdit: boolean;
  deadline: string | null;
}) {
  const queryClient = useQueryClient();
  const toLocalInput = (d: string | null) =>
    d ? new Date(new Date(d).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";
  const [value, setValue] = useState(toLocalInput(deadline));
  const [composing, setComposing] = useState(false);
  const reviewers = useQuery({
    queryKey: ["division", param.editionId, param.divisionId, "reviewers"],
    queryFn: () => unwrap(divisionApi().reviewers.$get({ param })),
  });
  const save = useMutation({
    mutationFn: (biddingDeadline: Date | null) =>
      unwrap(
        divisionApi().$patch({
          param,
          json: { biddingDeadline: biddingDeadline ? biddingDeadline.toISOString() : null } as never,
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["division", param.editionId, param.divisionId] }),
  });

  const open = !!deadline && new Date(deadline) > new Date();
  const pool = (reviewers.data ?? []).filter((r) => !r.excluded && r.canReview);
  const invited = pool.filter((r) => r.invitedAt).length;
  const bidded = pool.filter((r) => r.bids > 0).length;

  return (
    <Card title="Paper bidding (optional)">
      <ErrorText error={save.error} />
      <p className="mb-3 text-sm">
        Reviewers can bid on the submissions they would like to review. Without bidding, the
        matching uses similarity to their own work only.
      </p>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
        <span>Deadline</span>
        <input
          type="datetime-local"
          disabled={!canEdit}
          className="rounded border border-slate-300 px-2 py-1"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        {canEdit ? (
          <>
            <Button disabled={!value || save.isPending} onClick={() => save.mutate(new Date(value))}>
              Save
            </Button>
            {deadline ? (
              <Button
                variant="ghost"
                onClick={() => {
                  setValue("");
                  save.mutate(null);
                }}
              >
                No bidding
              </Button>
            ) : null}
          </>
        ) : null}
        <span className={open ? "text-green-700" : "text-slate-500"}>
          {open ? "open" : deadline ? "closed" : "no bidding"}
        </span>
      </div>
      {deadline ? (
        <p className="mb-3 text-sm">
          {invited} of {pool.length} reviewers invited, {bidded} have bid.
        </p>
      ) : null}
      {canEdit && open ? (
        composing ? (
          <Invite param={param} notInvited={pool.length - invited} onDone={() => setComposing(false)} />
        ) : (
          <Button onClick={() => setComposing(true)} disabled={pool.length === invited}>
            {pool.length === invited ? "Everyone is invited" : `Invite reviewers (${pool.length - invited} not invited yet)`}
          </Button>
        )
      ) : null}
    </Card>
  );
}

function Invite({ param, notInvited, onDone }: { param: Params; notInvited: number; onDone: () => void }) {
  const queryClient = useQueryClient();
  const template = useQuery({
    queryKey: ["invitation-template"],
    queryFn: () => unwrap(divisionApi().invitations.template.$get({ param })),
  });
  const [subject, setSubject] = useState<string>();
  const [body, setBody] = useState<string>();
  const send = useMutation({
    mutationFn: () =>
      unwrap(
        divisionApi().invitations.$post({
          param,
          json: { subject: subject ?? template.data!.subject, body: body ?? template.data!.body },
        }),
      ),
    onSuccess: () => {
      setTimeout(
        () => queryClient.invalidateQueries({ queryKey: ["division", param.editionId, param.divisionId, "reviewers"] }),
        3000,
      );
      onDone();
    },
  });
  if (!template.data) return null;
  return (
    <div className="flex flex-col gap-2 rounded border border-slate-200 p-3 text-sm">
      <p className="text-slate-600">
        Each reviewer gets a personal bidding link (no sign-in needed). You can use{" "}
        <code>{"{division}"}</code>, <code>{"{conference}"}</code>, <code>{"{deadline}"}</code> and{" "}
        <code>{"{link}"}</code>.
      </p>
      <Input value={subject ?? template.data.subject} onChange={(e) => setSubject(e.target.value)} />
      <textarea
        className="h-64 rounded border border-slate-300 p-2 font-mono text-xs"
        value={body ?? template.data.body}
        onChange={(e) => setBody(e.target.value)}
      />
      <div className="flex gap-2">
        <Button onClick={() => send.mutate()} disabled={send.isPending}>
          Send to {notInvited} reviewers
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      <ErrorText error={send.error} />
    </div>
  );
}
