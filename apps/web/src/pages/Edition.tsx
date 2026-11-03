import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { api, unwrap } from "../api";
import { Button, Card, ErrorText, Markdown } from "../ui";

type Kind = "submissions" | "persons" | "reviewers";

export default function Edition() {
  const { conferenceId, editionId } = useParams() as { conferenceId: string; editionId: string };
  const param = { conferenceId, editionId };
  const editionApi = api.conferences[":conferenceId"].editions[":editionId"];

  const conference = useQuery({
    queryKey: ["conference", conferenceId],
    queryFn: () => unwrap(api.conferences[":conferenceId"].$get({ param: { conferenceId } })),
  });
  const editions = useQuery({
    queryKey: ["conference", conferenceId, "editions"],
    queryFn: () => unwrap(api.conferences[":conferenceId"].editions.$get({ param: { conferenceId } })),
  });
  const jobs = useQuery({
    queryKey: ["edition", editionId, "imports"],
    queryFn: () => unwrap(editionApi.imports.$get({ param })),
    // follow running imports
    refetchInterval: (query) =>
      query.state.data?.some((j) => ["queued", "parsing", "writing", "embedding"].includes(j.status))
        ? 1500
        : false,
  });
  const summary = useQuery({
    queryKey: ["edition", editionId, "summary", jobs.data?.filter((j) => j.status === "done").length],
    queryFn: () => unwrap(editionApi.summary.$get({ param })),
  });

  const edition = editions.data?.find((e) => String(e.id) === editionId);
  const isAdmin = conference.data?.role === "admin";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link to={`/conferences/${conferenceId}`} className="text-sm text-blue-800 hover:underline">
          ← {conference.data?.name}
        </Link>
        <h1 className="text-2xl font-bold">{edition?.name ?? "…"}</h1>
      </div>

      <Card title="Overview">
        <ErrorText error={summary.error} />
        {summary.data ? (
          <div className="flex flex-col gap-3 text-sm">
            <table className="w-full">
              <thead className="text-left text-xs text-slate-500">
                <tr>
                  <th className="font-normal">Division</th>
                  <th className="font-normal">Submissions</th>
                  <th className="font-normal">Reviewers</th>
                </tr>
              </thead>
              <tbody>
                {summary.data.divisions.map((d) => (
                  <tr key={d.id} className="border-t border-slate-100">
                    <td className="py-1">{d.name}</td>
                    <td>{d.submissions}</td>
                    <td>{d.reviewers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p>
              {summary.data.submissions} submissions
              {summary.data.submissionsWithoutDivision > 0 ? (
                <span className="text-amber-800">
                  {" "}
                  ({summary.data.submissionsWithoutDivision} without a division)
                </span>
              ) : null}
              , {summary.data.reviewers} reviewers.
            </p>
            {summary.data.divisionLoad.length > 0 ? (
              <p className="text-slate-600">
                Reviewers per number of divisions:{" "}
                {summary.data.divisionLoad
                  .map((l) => `${l.divisions} division${l.divisions === 1 ? "" : "s"}: ${l.reviewers}`)
                  .join(" · ")}
              </p>
            ) : null}
          </div>
        ) : null}
      </Card>

      <Embeddings
        conferenceId={conferenceId}
        editionId={editionId}
        isAdmin={isAdmin}
        refreshKey={jobs.data?.map((j) => `${j.id}:${j.status}:${j.counts.embedded ?? 0}`).join()}
      />

      {isAdmin ? (
        <Imports conferenceId={conferenceId} editionId={editionId} />
      ) : (
        <p className="text-sm text-slate-600">Conference admins import the data for this edition.</p>
      )}

      <Card title="Import history">
        <ErrorText error={jobs.error} />
        {jobs.data?.length === 0 ? <p className="text-sm text-slate-600">No imports yet.</p> : null}
        <ul className="flex flex-col divide-y divide-slate-100">
          {jobs.data?.map((job) => (
            <li key={job.id} className="py-2 text-sm">
              <div className="flex justify-between">
                <span>
                  <b>{job.kind}</b> · {job.filename}
                </span>
                <JobStatus status={job.status} done={job.doneChunks} total={job.totalChunks} />
              </div>
              {Object.keys(job.counts).length > 0 ? (
                <p className="text-xs text-slate-600">
                  {Object.entries(job.counts)
                    .map(([k, v]) => `${k}: ${v}`)
                    .join(" · ")}
                </p>
              ) : null}
              {job.warnings.map((w) => (
                <p key={w} className="text-xs text-amber-800">
                  {w}
                </p>
              ))}
              {job.error ? <p className="text-xs text-red-700">{job.error}</p> : null}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}

/** Embeddings make the similarity matching work. Computed after importing
 *  submissions; can be computed again, e.g. after the model changed */
function Embeddings({
  conferenceId,
  editionId,
  isAdmin,
  refreshKey,
}: {
  conferenceId: string;
  editionId: string;
  isAdmin: boolean;
  refreshKey?: string;
}) {
  const param = { conferenceId, editionId };
  const embeddingsApi = api.conferences[":conferenceId"].editions[":editionId"].embeddings;
  const status = useQuery({
    queryKey: ["edition", editionId, "embeddings", refreshKey],
    queryFn: () => unwrap(embeddingsApi.$get({ param })),
    refetchInterval: (query) => ((query.state.data?.pending ?? 0) > 0 ? 3000 : false),
  });
  const compute = useMutation({
    mutationFn: () => unwrap(embeddingsApi.$post({ param })),
    onSuccess: () => status.refetch(),
  });
  if (!status.data || status.data.total === 0) return null;
  const { model, total, pending } = status.data;

  return (
    <Card title="Embeddings">
      <ErrorText error={status.error || compute.error} />
      <p className="text-sm">
        {total - pending} of {total} submissions have an embedding{" "}
        <span className="text-xs text-slate-500">({model})</span>.
        {model.startsWith("dev-") ? (
          <span className="text-amber-800"> Development stand-in: similarity is based on shared words only.</span>
        ) : null}
      </p>
      {pending > 0 && isAdmin ? (
        <Button className="mt-2" onClick={() => compute.mutate()} disabled={compute.isPending}>
          Compute missing embeddings
        </Button>
      ) : null}
    </Card>
  );
}

function JobStatus({ status, done, total }: { status: string; done: number; total: number | null }) {
  const color =
    status === "done" ? "text-green-700" : status === "failed" ? "text-red-700" : "text-blue-700";
  return (
    <span className={`text-xs ${color}`}>
      {status}
      {status === "writing" && total ? ` ${done}/${total}` : ""}
      {status === "embedding" ? "…" : ""}
    </span>
  );
}

function Imports({ conferenceId, editionId }: { conferenceId: string; editionId: string }) {
  const param = { conferenceId, editionId };
  const specs = useQuery({
    queryKey: ["edition", editionId, "import-specs"],
    queryFn: () =>
      unwrap(api.conferences[":conferenceId"].editions[":editionId"].imports.specs.$get({ param })),
  });
  const [kind, setKind] = useState<Kind>("submissions");
  const spec = specs.data?.find((s) => s.kind === kind);

  return (
    <Card title="Import data">
      <ErrorText error={specs.error} />
      <div className="mb-4 flex gap-1">
        {specs.data?.map((s) => (
          <Button key={s.kind} variant={s.kind === kind ? "primary" : "ghost"} onClick={() => setKind(s.kind)}>
            {s.label}
          </Button>
        ))}
      </div>
      {spec ? <ImportForm key={kind} conferenceId={conferenceId} editionId={editionId} spec={spec} /> : null}
    </Card>
  );
}

type Spec = {
  kind: Kind;
  label: string;
  instructions: { text: string; warning?: string }[];
  fields: { field: string; label: string; required: boolean }[];
};

function ImportForm({ conferenceId, editionId, spec }: { conferenceId: string; editionId: string; spec: Spec }) {
  const queryClient = useQueryClient();
  const param = { conferenceId, editionId };
  const imports = api.conferences[":conferenceId"].editions[":editionId"].imports;
  const [uploaded, setUploaded] = useState<{ jobId: number; headers: string[] }>();
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const upload = useMutation({
    mutationFn: (file: File) =>
      unwrap(
        imports.$post(
          { param, query: { kind: spec.kind, filename: file.name } },
          { init: { body: file, headers: { "Content-Type": "text/csv" } } },
        ),
      ),
    onSuccess: (res) => {
      setUploaded({ jobId: res.job.id, headers: res.headers });
      setMapping(res.job.mapping ?? {});
    },
  });
  const start = useMutation({
    mutationFn: () =>
      unwrap(
        imports[":jobId"].start.$post({
          param: { ...param, jobId: String(uploaded!.jobId) },
          json: { mapping },
        }),
      ),
    onSuccess: () => {
      setUploaded(undefined);
      queryClient.invalidateQueries({ queryKey: ["edition", editionId, "imports"] });
    },
  });

  return (
    <div className="flex flex-col gap-4 text-sm">
      <ol className="ml-5 list-decimal leading-6">
        {spec.instructions.map((step) => (
          <li key={step.text}>
            <Markdown text={step.text} />
            {step.warning ? <p className="text-amber-800">{step.warning}</p> : null}
          </li>
        ))}
      </ol>

      {!uploaded ? (
        <label className="cursor-pointer rounded border-2 border-dashed border-slate-300 p-4 text-center hover:bg-slate-50">
          {upload.isPending ? "Uploading…" : "Click to select the CSV file"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            disabled={upload.isPending}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) upload.mutate(file);
              e.target.value = "";
            }}
          />
        </label>
      ) : (
        <div className="flex flex-col gap-2">
          <p className="font-medium">Check the columns</p>
          <div className="grid grid-cols-[12rem_1fr] items-center gap-2">
            {spec.fields.map((f) => (
              <div key={f.field} className="contents">
                <span>
                  {f.label}
                  {f.required ? "" : <span className="text-slate-500"> (optional)</span>}
                </span>
                <select
                  className={`rounded border px-2 py-1 ${f.required && !mapping[f.field] ? "border-red-400" : "border-slate-300"}`}
                  value={mapping[f.field] ?? ""}
                  onChange={(e) => setMapping({ ...mapping, [f.field]: e.target.value })}
                >
                  <option value="">(none)</option>
                  {uploaded.headers.map((h) => (
                    <option key={h} value={h}>
                      {h}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button onClick={() => start.mutate()} disabled={start.isPending}>
              Import
            </Button>
            <Button variant="ghost" onClick={() => setUploaded(undefined)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <ErrorText error={upload.error || start.error} />
    </div>
  );
}
