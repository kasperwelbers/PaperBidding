import { env } from "cloudflare:workers";
import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { DEV_HASH_MODEL } from "@cp/shared";
import { createDb, submissions } from "@cp/db";
import { getEmbedder } from "../src/embeddings";
import { drainTestQueue } from "../src/imports/process";
import { signIn } from "./helpers";

const json = async (res: Response) => (await res.json()) as any;
const header = "CONTROL ID,TITLE,ABSTRACT BODY,AUTHOR (E-mail),INSTITUTIONS (ALL),CURRENT CATEGORY";

async function setup() {
  const admin = await signIn("super@example.com");
  const conference = await json(
    await admin("/api/conferences", { method: "POST", body: { name: "ICA", platform: "scholarone", preset: "ica" } }),
  );
  const base = `/api/conferences/${conference.id}`;
  const edition = await json(await admin(`${base}/editions`, { method: "POST", body: { name: "2027" } }));
  const editionBase = `${base}/editions/${edition.id}`;

  /** uploads and starts an import, without processing the queue */
  async function startImport(kind: string, rows: string[], head = header) {
    const { job } = await json(
      await admin(`${editionBase}/imports?kind=${kind}&filename=f.csv`, { file: [head, ...rows].join("\n") }),
    );
    await admin(`${editionBase}/imports/${job.id}/start`, { method: "POST", body: { mapping: job.mapping } });
    return job.id as number;
  }
  const jobStatus = async (jobId: number) => json(await admin(`${editionBase}/imports/${jobId}`));
  return { admin, base, editionBase, editionId: edition.id as number, conferenceId: conference.id as number, startImport, jobStatus };
}

const papers = [
  `1,Large language models for content analysis,Automated content analysis of news with large language models and word embeddings,a@x.org,,`,
  `2,Topic models of news,Computational text analysis of news using topic models and word embeddings,b@x.org,,`,
  `3,Vaccine messaging,Vaccine hesitancy and health messaging during the pandemic,c@x.org,,`,
];

describe("embeddings", () => {
  it("computes embeddings after a submissions import", async () => {
    const { editionBase, editionId, startImport, jobStatus, admin } = await setup();
    const jobId = await startImport("submissions", papers);
    await drainTestQueue(env);

    const job = await jobStatus(jobId);
    expect(job.status).toBe("done");
    expect(job.counts.embedded).toBe(3);
    const db = createDb(env.DB);
    const rows = await db.query.submissions.findMany({ where: eq(submissions.editionId, editionId) });
    expect(rows.every((r) => r.embeddingModel === DEV_HASH_MODEL && r.embedding?.byteLength === 384 * 4)).toBe(true);
    expect(await json(await admin(`${editionBase}/embeddings`))).toEqual({ model: DEV_HASH_MODEL, total: 3, pending: 0 });
  });

  it("only recomputes embeddings of changed texts", async () => {
    const { startImport, jobStatus } = await setup();
    await startImport("submissions", papers);
    await drainTestQueue(env);
    const changed = [papers[0]!, papers[1]!, papers[2]!.replace("during the pandemic", "on social media")];
    const jobId = await startImport("submissions", changed);
    await drainTestQueue(env);
    expect((await jobStatus(jobId)).counts.embedded).toBe(1);
  });

  it("finds similar submissions", async () => {
    const { editionBase, editionId, startImport, admin } = await setup();
    await startImport("submissions", papers);
    await drainTestQueue(env);
    const db = createDb(env.DB);
    const first = await db.query.submissions.findFirst({
      where: and(eq(submissions.editionId, editionId), eq(submissions.externalId, "1")),
    });
    const similar = await json(await admin(`${editionBase}/submissions/${first!.id}/similar?limit=2`));
    expect(similar.map((s: any) => s.externalId)).toEqual(["2", "3"]);
    expect(similar[0].similarity).toBeGreaterThan(similar[1].similarity);
  });

  it("refuses the stand-in embedder in production", () => {
    expect(() => getEmbedder({ ...env, ENVIRONMENT: "production", EMBEDDINGS: "dev-hash" })).toThrow();
    expect(getEmbedder({ ...env, ENVIRONMENT: "production", EMBEDDINGS: "" }).model).toBe("@cf/baai/bge-small-en-v1.5");
  });
});

describe("imports at the same time", () => {
  it("does not create the same person twice", async () => {
    const { conferenceId, startImport, jobStatus } = await setup();
    // two imports with the same (new) people, started before either runs
    const a = await startImport("submissions", papers);
    const b = await startImport(
      "reviewers",
      ["p1,a@x.org,Computational Methods", "p2,b@x.org,Computational Methods"],
      "PERSON (ID),PERSON (EMAIL),PERSON (AREA OF EXPERTISE)",
    );
    await drainTestQueue(env);
    expect((await jobStatus(a)).status).toBe("done");
    expect((await jobStatus(b)).status).toBe("done");
    const db = createDb(env.DB);
    const [row] = (await db.all(
      sql`select count(*) as n from persons where conference_id = ${conferenceId}`,
    )) as { n: number }[];
    expect(row!.n).toBe(3);
  });
});

describe("demo conference", () => {
  it("loads a synthetic conference through the import pipeline", async () => {
    const admin = await signIn("super@example.com");
    const res = await admin("/api/dev/demo", { method: "POST" });
    expect(res.status).toBe(201);
    const { conferenceId, editionId } = await json(res);
    await drainTestQueue(env);

    const base = `/api/conferences/${conferenceId}`;
    const jobs = await json(await admin(`${base}/editions/${editionId}/imports`));
    expect(jobs.map((j: any) => j.status)).toEqual(["done", "done"]);

    const summary = await json(await admin(`${base}/editions/${editionId}/summary`));
    expect(summary.submissions).toBe(160);
    expect(summary.submissionsWithoutDivision).toBe(0);
    expect(summary.divisions.every((d: any) => d.submissions === 40 && d.reviewers > 0)).toBe(true);
    expect(summary.divisionLoad.some((l: any) => l.divisions >= 2)).toBe(true);
    expect((await json(await admin(`${base}/editions/${editionId}/embeddings`))).pending).toBe(0);

    const keywords = await json(await admin(`${base}/keywords`));
    expect(keywords.filter((k: any) => k.divisionId === null).map((k: any) => k.text)).toEqual([
      "Game Studies: esports",
    ]);
  });

  it("is not available to others", async () => {
    const user = await signIn("someone@example.com");
    expect((await user("/api/dev/demo", { method: "POST" })).status).toBe(404);
  });
});
