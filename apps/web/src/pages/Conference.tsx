import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { api, unwrap } from "../api";
import { Button, Card, ErrorText, Input } from "../ui";

type Division = { id: number; name: string };

export default function Conference() {
  const conferenceId = useParams().conferenceId!;
  const param = { conferenceId };
  const conference = useQuery({
    queryKey: ["conference", conferenceId],
    queryFn: () => unwrap(api.conferences[":conferenceId"].$get({ param })),
  });
  const divisions = useQuery({
    queryKey: ["conference", conferenceId, "divisions"],
    queryFn: () => unwrap(api.conferences[":conferenceId"].divisions.$get({ param })),
  });

  if (conference.error) return <ErrorText error={conference.error} />;
  if (!conference.data) return <p className="text-sm text-slate-500">Loading…</p>;
  const isAdmin = conference.data.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">{conference.data.name}</h1>
        <p className="text-sm text-slate-600">
          {conference.data.platform}
          {conference.data.preset ? ` · preset: ${conference.data.preset}` : ""} · you are{" "}
          {conference.data.role === "admin" ? "a conference admin" : "a planner"}
        </p>
      </div>
      <Editions conferenceId={conferenceId} isAdmin={isAdmin} />
      <Divisions conferenceId={conferenceId} isAdmin={isAdmin} divisions={divisions.data ?? []} />
      <ConflictRulesCard
        conferenceId={conferenceId}
        isAdmin={isAdmin}
        rules={conference.data.conflictRules}
      />
      <Institutions conferenceId={conferenceId} isAdmin={isAdmin} />
      <Keywords conferenceId={conferenceId} isAdmin={isAdmin} divisions={divisions.data ?? []} />
      <Conflicts conferenceId={conferenceId} isAdmin={isAdmin} />
      <Users conferenceId={conferenceId} isAdmin={isAdmin} divisions={divisions.data ?? []} />
    </div>
  );
}

function Editions({ conferenceId, isAdmin }: { conferenceId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const param = { conferenceId };
  const key = ["conference", conferenceId, "editions"];
  const [name, setName] = useState("");
  const editions = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.conferences[":conferenceId"].editions.$get({ param })),
  });
  const add = useMutation({
    mutationFn: () => unwrap(api.conferences[":conferenceId"].editions.$post({ param, json: { name } })),
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: key });
    },
  });

  return (
    <Card title="Editions">
      <ErrorText error={editions.error || add.error} />
      {editions.data?.length === 0 ? (
        <p className="text-sm text-slate-600">No editions yet. An edition is one round, e.g. "ICA 2027".</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1 text-sm">
          {editions.data?.map((e) => (
            <li key={e.id}>
              <Link
                to={`/conferences/${conferenceId}/editions/${e.id}`}
                className="text-blue-800 hover:underline"
              >
                {e.name}
              </Link>{" "}
              <span className="text-xs text-slate-500">
                created {new Date(e.createdAt).toLocaleDateString()}
              </span>
            </li>
          ))}
        </ul>
      )}
      {isAdmin ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Input required placeholder="e.g. ICA 2027" value={name} onChange={(e) => setName(e.target.value)} />
          <Button disabled={add.isPending}>Add edition</Button>
        </form>
      ) : null}
    </Card>
  );
}

function Divisions({
  conferenceId,
  isAdmin,
  divisions,
}: {
  conferenceId: string;
  isAdmin: boolean;
  divisions: Division[];
}) {
  const queryClient = useQueryClient();
  const param = { conferenceId };
  const [name, setName] = useState("");
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["conference", conferenceId] });
  const add = useMutation({
    mutationFn: () => unwrap(api.conferences[":conferenceId"].divisions.$post({ param, json: { name } })),
    onSuccess: () => {
      setName("");
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (divisionId: number) =>
      unwrap(
        api.conferences[":conferenceId"].divisions[":divisionId"].$delete({
          param: { conferenceId, divisionId: String(divisionId) },
        }),
      ),
    onSuccess: refresh,
  });

  return (
    <Card title="Divisions">
      <ErrorText error={add.error || remove.error} />
      {divisions.length === 0 ? (
        <p className="mb-3 text-sm text-slate-600">No divisions yet.</p>
      ) : (
        <ul className="mb-3 flex flex-col gap-1 text-sm">
          {divisions.map((d) => (
            <li key={d.id} className="flex items-center justify-between">
              {d.name}
              {isAdmin ? (
                <Button
                  variant="danger"
                  onClick={() => {
                    if (confirm(`Delete division "${d.name}"?`)) remove.mutate(d.id);
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {isAdmin ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <Input
            required
            placeholder="Division name, as in the platform"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="flex-1"
          />
          <Button disabled={add.isPending}>Add division</Button>
        </form>
      ) : null}
    </Card>
  );
}

function DivisionPicker({
  divisions,
  value,
  onChange,
}: {
  divisions: Division[];
  value: number[];
  onChange: (ids: number[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {divisions.map((d) => (
        <label key={d.id} className="flex items-center gap-1 text-xs">
          <input
            type="checkbox"
            checked={value.includes(d.id)}
            onChange={(e) =>
              onChange(e.target.checked ? [...value, d.id] : value.filter((id) => id !== d.id))
            }
          />
          {d.name}
        </label>
      ))}
    </div>
  );
}

function Users({
  conferenceId,
  isAdmin,
  divisions,
}: {
  conferenceId: string;
  isAdmin: boolean;
  divisions: Division[];
}) {
  const queryClient = useQueryClient();
  const param = { conferenceId };
  const key = ["conference", conferenceId, "users"];
  const refresh = () => queryClient.invalidateQueries({ queryKey: key });
  const users = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.conferences[":conferenceId"].users.$get({ param })),
  });

  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "planner">("planner");
  const [divisionIds, setDivisionIds] = useState<number[]>([]);
  const add = useMutation({
    mutationFn: () =>
      unwrap(api.conferences[":conferenceId"].users.$post({ param, json: { email, role, divisionIds } })),
    onSuccess: () => {
      setEmail("");
      setDivisionIds([]);
      refresh();
    },
  });
  const update = useMutation({
    mutationFn: (v: { userId: number; role?: "admin" | "planner"; divisionIds?: number[] }) =>
      unwrap(
        api.conferences[":conferenceId"].users[":userId"].$patch({
          param: { conferenceId, userId: String(v.userId) },
          json: { role: v.role, divisionIds: v.divisionIds },
        }),
      ),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: (userId: number) =>
      unwrap(
        api.conferences[":conferenceId"].users[":userId"].$delete({
          param: { conferenceId, userId: String(userId) },
        }),
      ),
    onSuccess: refresh,
  });

  const divisionName = (id: number) => divisions.find((d) => d.id === id)?.name ?? "?";

  return (
    <Card title="Users">
      <ErrorText error={users.error || add.error || update.error || remove.error} />
      <ul className="mb-4 flex flex-col divide-y divide-slate-100">
        {users.data?.map((u) => (
          <li key={u.id} className="flex flex-col gap-1 py-2 text-sm">
            <div className="flex items-center justify-between gap-2">
              <span className="font-medium">{u.email}</span>
              {isAdmin ? (
                <div className="flex items-center gap-1">
                  <select
                    className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                    value={u.role}
                    onChange={(e) =>
                      update.mutate({ userId: u.id, role: e.target.value as "admin" | "planner" })
                    }
                  >
                    <option value="admin">admin</option>
                    <option value="planner">planner</option>
                  </select>
                  <Button variant="danger" onClick={() => remove.mutate(u.id)}>
                    Remove
                  </Button>
                </div>
              ) : (
                <span className="text-xs text-slate-500">{u.role}</span>
              )}
            </div>
            {u.role === "planner" ? (
              isAdmin ? (
                <DivisionPicker
                  divisions={divisions}
                  value={u.divisionIds}
                  onChange={(ids) => update.mutate({ userId: u.id, divisionIds: ids })}
                />
              ) : (
                <span className="text-xs text-slate-600">
                  {u.divisionIds.map(divisionName).join(", ") || "no divisions"}
                </span>
              )
            ) : null}
          </li>
        ))}
      </ul>
      {isAdmin ? (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            add.mutate();
          }}
        >
          <div className="flex gap-2">
            <Input
              type="email"
              required
              placeholder="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <select
              className="rounded border border-slate-300 px-2 text-sm"
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "planner")}
            >
              <option value="planner">planner</option>
              <option value="admin">admin</option>
            </select>
            <Button disabled={add.isPending}>Add user</Button>
          </div>
          {role === "planner" && divisions.length > 0 ? (
            <DivisionPicker divisions={divisions} value={divisionIds} onChange={setDivisionIds} />
          ) : null}
        </form>
      ) : null}
    </Card>
  );
}

/** Expertise keywords and their divisions. Keywords without a division
 *  ("orphans") come first, so admins can assign them */
function Keywords({
  conferenceId,
  isAdmin,
  divisions,
}: {
  conferenceId: string;
  isAdmin: boolean;
  divisions: Division[];
}) {
  const queryClient = useQueryClient();
  const param = { conferenceId };
  const key = ["conference", conferenceId, "keywords"];
  const [showAll, setShowAll] = useState(false);
  const keywords = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.conferences[":conferenceId"].keywords.$get({ param })),
  });
  const assign = useMutation({
    mutationFn: (v: { keywordId: number; divisionId: number | null }) =>
      unwrap(
        api.conferences[":conferenceId"].keywords[":keywordId"].$patch({
          param: { conferenceId, keywordId: String(v.keywordId) },
          json: { divisionId: v.divisionId },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });
  const autoAssign = useMutation({
    mutationFn: () => unwrap(api.conferences[":conferenceId"].keywords["auto-assign"].$post({ param })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const all = keywords.data ?? [];
  if (all.length === 0) return null;
  const orphans = all.filter((k) => k.divisionId === null);
  const shown = showAll ? all : orphans;

  return (
    <Card title="Expertise keywords">
      <ErrorText error={keywords.error || assign.error || autoAssign.error} />
      <p className="mb-3 text-sm">
        {all.length} keywords.{" "}
        {orphans.length > 0 ? (
          <span className="text-amber-800">
            {orphans.length} {orphans.length === 1 ? "is" : "are"} not linked to a division, so
            their reviewers are not linked either.
          </span>
        ) : (
          "All are linked to a division."
        )}
      </p>
      <div className="mb-3 flex gap-2">
        <Button variant="ghost" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show only unlinked" : "Show all"}
        </Button>
        {isAdmin ? (
          <Button variant="ghost" onClick={() => autoAssign.mutate()} disabled={autoAssign.isPending}>
            Match by division name again
          </Button>
        ) : null}
      </div>
      <ul className="flex max-h-96 flex-col divide-y divide-slate-100 overflow-auto">
        {shown.map((k) => (
          <li key={k.id} className="flex items-center justify-between gap-2 py-1 text-sm">
            <span>
              {k.text} <span className="text-xs text-slate-500">({k.reviewers} reviewers)</span>
            </span>
            <select
              disabled={!isAdmin}
              className="rounded border border-slate-300 px-1 py-0.5 text-xs"
              value={k.divisionId ?? ""}
              onChange={(e) =>
                assign.mutate({
                  keywordId: k.id,
                  divisionId: e.target.value ? Number(e.target.value) : null,
                })
              }
            >
              <option value="">(no division)</option>
              {divisions.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Identifiers (emails) that an import could not apply, because they belong
 *  to another person */
function Conflicts({ conferenceId, isAdmin }: { conferenceId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const param = { conferenceId };
  const key = ["conference", conferenceId, "conflicts"];
  const conflicts = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.conferences[":conferenceId"]["import-conflicts"].$get({ param })),
  });
  const resolve = useMutation({
    mutationFn: (v: { conflictId: number; action: "keep" | "move" }) =>
      unwrap(
        api.conferences[":conferenceId"]["import-conflicts"][":conflictId"].resolve.$post({
          param: { conferenceId, conflictId: String(v.conflictId) },
          json: { action: v.action },
        }),
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  if (!conflicts.data?.length) return null;
  const describe = (ids: { kind: string; value: string }[]) =>
    ids.map((i) => (i.kind === "platform_id" ? `ID ${i.value}` : i.value)).join(", ") || "?";

  return (
    <Card title="Import conflicts">
      <ErrorText error={resolve.error} />
      <p className="mb-3 text-sm">
        These emails were imported for one person, but already belong to another. They were not
        moved.
      </p>
      <ul className="flex flex-col divide-y divide-slate-100 text-sm">
        {conflicts.data.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-2 py-2">
            <span>
              <b>{c.value}</b> belongs to {describe(c.existing.identifiers)}; the import gave it
              to {describe(c.incoming.identifiers)}
            </span>
            {isAdmin ? (
              <span className="flex shrink-0 gap-1">
                <Button variant="ghost" onClick={() => resolve.mutate({ conflictId: c.id, action: "keep" })}>
                  Keep
                </Button>
                <Button variant="ghost" onClick={() => resolve.mutate({ conflictId: c.id, action: "move" })}>
                  Move
                </Button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </Card>
  );
}

type ConflictRules = {
  coAuthorsCurrentEdition: boolean;
  coAuthorsPreviousEditions: boolean;
  sameInstitution: boolean;
};

const ruleLabels: Record<keyof ConflictRules, string> = {
  coAuthorsCurrentEdition: "Not their co-authors in this edition",
  coAuthorsPreviousEditions: "Not their co-authors in earlier editions of this conference",
  sameInstitution: "Not submissions with an author from their current institution",
};

/** Who may review whom: used by both the bidding page and the matching */
function ConflictRulesCard({
  conferenceId,
  isAdmin,
  rules,
}: {
  conferenceId: string;
  isAdmin: boolean;
  rules: ConflictRules;
}) {
  const queryClient = useQueryClient();
  const save = useMutation({
    mutationFn: (conflictRules: ConflictRules) =>
      unwrap(api.conferences[":conferenceId"].$patch({ param: { conferenceId }, json: { conflictRules } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["conference", conferenceId] }),
  });

  return (
    <Card title="Who may review whom">
      <ErrorText error={save.error} />
      <p className="mb-2 text-sm">Reviewers never review their own submissions, and:</p>
      <div className="flex flex-col gap-1 text-sm">
        {(Object.keys(ruleLabels) as (keyof ConflictRules)[]).map((key) => (
          <label key={key} className="flex items-center gap-2">
            <input
              type="checkbox"
              disabled={!isAdmin || save.isPending}
              checked={rules[key]}
              onChange={(e) => save.mutate({ ...rules, [key]: e.target.checked })}
            />
            {ruleLabels[key]}
          </label>
        ))}
      </div>
    </Card>
  );
}

/** Institution names in the data that are not in the university list. Admins
 *  can map them to a university, or confirm them as their own institution */
function Institutions({ conferenceId, isAdmin }: { conferenceId: string; isAdmin: boolean }) {
  const queryClient = useQueryClient();
  const param = { conferenceId };
  const key = ["conference", conferenceId, "institutions"];
  const [showAll, setShowAll] = useState(false);
  const unresolved = useQuery({
    queryKey: key,
    queryFn: () => unwrap(api.conferences[":conferenceId"].institutions.unresolved.$get({ param })),
  });
  const alias = useMutation({
    mutationFn: (v: { text: string; institution: string }) =>
      unwrap(api.conferences[":conferenceId"].institutions.aliases.$put({ param, json: v })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: key }),
  });

  const all = unresolved.data ?? [];
  if (all.length === 0) return null;
  const shown = showAll ? all : all.slice(0, 15);

  return (
    <Card title="Institutions">
      <ErrorText error={unresolved.error || alias.error} />
      <p className="mb-3 text-sm">
        {all.length} institution {all.length === 1 ? "name is" : "names are"} not in the
        university list, so they only match when written exactly the same. Pick the right
        university, or keep a name as an institution of its own.
      </p>
      <ul className="flex flex-col divide-y divide-slate-100">
        {shown.map((u) => (
          <li key={u.name} className="flex flex-wrap items-center justify-between gap-2 py-1 text-sm">
            <span>
              {u.name} <span className="text-xs text-slate-500">({u.count})</span>
            </span>
            {isAdmin ? (
              <span className="flex items-center gap-1">
                <UniversityPicker onPick={(institution) => alias.mutate({ text: u.name, institution })} />
                <Button variant="ghost" onClick={() => alias.mutate({ text: u.name, institution: u.name })}>
                  Keep as is
                </Button>
              </span>
            ) : null}
          </li>
        ))}
      </ul>
      {all.length > shown.length || showAll ? (
        <Button variant="ghost" onClick={() => setShowAll(!showAll)}>
          {showAll ? "Show fewer" : `Show all ${all.length}`}
        </Button>
      ) : null}
    </Card>
  );
}

function UniversityPicker({ onPick }: { onPick: (name: string) => void }) {
  const [q, setQ] = useState("");
  const found = useQuery({
    queryKey: ["universities", q],
    queryFn: () => unwrap(api.institutions.search.$get({ query: { q } })),
    enabled: q.trim().length >= 3,
  });
  const listId = `universities-${q}`;
  return (
    <form
      className="flex gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const match = found.data?.find((u) => u.name === q);
        if (match) onPick(match.name);
      }}
    >
      <Input
        list={listId}
        placeholder="search university"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="w-56 py-0.5 text-xs"
      />
      <datalist id={listId}>
        {found.data?.map((u) => (
          <option key={u.name} value={u.name}>
            {u.country}
          </option>
        ))}
      </datalist>
      <Button disabled={!found.data?.some((u) => u.name === q)}>Use</Button>
    </form>
  );
}
