import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useParams } from "react-router";
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
              {e.name}{" "}
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
