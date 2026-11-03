import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { api, unwrap } from "../api";
import { Button, Card, ErrorText, Input } from "../ui";
import type { Me } from "../App";

export default function Home({ me }: { me: Me }) {
  const conferences = useQuery({
    queryKey: ["conferences"],
    queryFn: () => unwrap(api.conferences.$get()),
  });

  return (
    <div className="flex flex-col gap-6">
      <Card title="Your conferences">
        <ErrorText error={conferences.error} />
        {conferences.data?.length === 0 ? (
          <p className="text-sm text-slate-600">
            You are not part of a conference yet. A conference admin can add you.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {conferences.data?.map((c) => (
              <li key={c.id}>
                <Link to={`/conferences/${c.id}`} className="text-blue-800 hover:underline">
                  {c.name}
                </Link>{" "}
                <span className="text-xs text-slate-500">{c.role}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {me.isAdmin ? <CreateConference /> : null}
      {import.meta.env.DEV && me.isSuperadmin ? <LoadDemo /> : null}
      {me.isSuperadmin ? (
        <p className="text-sm">
          <Link to="/admins" className="text-blue-800 hover:underline">
            Manage admins
          </Link>{" "}
          (who can create conferences)
        </p>
      ) : null}
    </div>
  );
}

function CreateConference() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const platforms = useQuery({
    queryKey: ["platforms"],
    queryFn: () => unwrap(api.platforms.$get()),
  });
  const [choice, setChoice] = useState("scholarone:ica");

  const create = useMutation({
    mutationFn: () => {
      const [platform, preset] = choice.split(":");
      return unwrap(
        api.conferences.$post({
          json: { name, platform: platform as "scholarone", preset: preset || undefined },
        }),
      );
    },
    onSuccess: (conference) => {
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
      navigate(`/conferences/${conference.id}`);
    },
  });

  return (
    <Card title="New conference">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          create.mutate();
        }}
      >
        <Input required placeholder="Name, e.g. ICA" value={name} onChange={(e) => setName(e.target.value)} />
        <select
          className="rounded border border-slate-300 px-2 py-1.5 text-sm"
          value={choice}
          onChange={(e) => setChoice(e.target.value)}
        >
          {platforms.data?.flatMap((p) => [
            ...p.presets.map((preset) => (
              <option key={`${p.id}:${preset.id}`} value={`${p.id}:${preset.id}`}>
                {p.name}: {preset.name}
              </option>
            )),
            <option key={p.id} value={`${p.id}:`}>
              {p.name} (no preset)
            </option>,
          ])}
        </select>
        <Button disabled={create.isPending}>Create</Button>
      </form>
      <ErrorText error={create.error} />
    </Card>
  );
}

/** Development only: a synthetic conference, loaded through the import pipeline */
function LoadDemo() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const load = useMutation({
    mutationFn: () => unwrap(api.dev.demo.$post()),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["conferences"] });
      navigate(`/conferences/${res.conferenceId}/editions/${res.editionId}`);
    },
  });
  return (
    <Card title="Development">
      <p className="mb-2 text-sm text-slate-600">
        Load a demo conference with synthetic submissions and reviewers (two editions, four
        divisions). It uses the local stand-in embeddings.
      </p>
      <Button onClick={() => load.mutate()} disabled={load.isPending}>
        Load demo conference
      </Button>
      <ErrorText error={load.error} />
    </Card>
  );
}
