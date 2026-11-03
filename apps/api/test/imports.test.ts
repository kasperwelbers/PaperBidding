import { env } from "cloudflare:workers";
import { sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "@cp/db";
import { drainTestQueue } from "../src/imports/process";
import { signIn } from "./helpers";

const json = async (res: Response) => (await res.json()) as any;

/** An admin with an ICA conference, two divisions and an edition */
async function setup() {
  const superadmin = await signIn("super@example.com");
  const conference = await json(
    await superadmin("/api/conferences", {
      method: "POST",
      body: { name: "ICA", platform: "scholarone", preset: "ica" },
    }),
  );
  const base = `/api/conferences/${conference.id}`;
  for (const name of ["Computational Methods", "Political Communication"])
    await superadmin(`${base}/divisions`, { method: "POST", body: { name } });
  const edition = await json(
    await superadmin(`${base}/editions`, { method: "POST", body: { name: "ICA 2027" } }),
  );
  const editionBase = `${base}/editions/${edition.id}`;

  /** upload, start with the proposed mapping, and process the queue */
  async function runImport(kind: string, file: string, mapping?: Record<string, string>) {
    const upload = await superadmin(`${editionBase}/imports?kind=${kind}&filename=test.csv`, { file });
    expect(upload.status).toBe(201);
    const { job, headers } = await json(upload);
    const start = await superadmin(`${editionBase}/imports/${job.id}/start`, {
      method: "POST",
      body: { mapping: mapping ?? job.mapping },
    });
    if (start.status !== 200) return { start, job, headers };
    await drainTestQueue(env);
    return { start, job: await json(await superadmin(`${editionBase}/imports/${job.id}`)), headers };
  }
  return { superadmin, base, editionBase, runImport, conferenceId: conference.id as number, editionId: edition.id as number };
}

const submissionsCsv = (n: number) =>
  [
    "CONTROL ID,TITLE,ABSTRACT BODY,AUTHOR (E-mail),INSTITUTIONS (ALL),CURRENT CATEGORY,SUBMITTER (EMAIL)",
    ...Array.from({ length: n }, (_, i) => {
      const division = i % 3 === 0 ? "Political Communication" : i % 3 === 1 ? "Computational Methods" : "Health Communication";
      return [
        `${1000 + i},Title ${i},Abstract ${i},author${i}@uni.edu,Uni,${division},s@x`,
        `${1000 + i},Title ${i},Abstract ${i},coauthor@uni.edu,Uni,${division},s@x`,
      ].join("\n");
    }),
  ].join("\n");

const reviewersCsv = [
  "PERSON (ID),PERSON (EMAIL),PERSON (AREA OF EXPERTISE),STUDENT,REVIEWER",
  "p1,author0@uni.edu,Computational Methods: content analysis,No,Yes",
  "p1,author0@uni.edu,Political Communication,No,Yes",
  "p2,reviewer2@uni.edu,Health Communication: vaccines,Yes,Yes",
].join("\n");

describe("imports", () => {
  it("proposes a column mapping from the header row", async () => {
    const { superadmin, editionBase } = await setup();
    const res = await superadmin(`${editionBase}/imports?kind=submissions&filename=s.csv`, {
      file: submissionsCsv(1),
    });
    const { job } = await json(res);
    expect(job.mapping).toMatchObject({
      externalId: "CONTROL ID",
      authorEmail: "AUTHOR (E-mail)",
      division: "CURRENT CATEGORY",
    });
  });

  it("refuses the submitter column as author column", async () => {
    const { runImport } = await setup();
    const { start } = await runImport("submissions", submissionsCsv(1), {
      externalId: "CONTROL ID",
      title: "TITLE",
      abstract: "ABSTRACT BODY",
      authorEmail: "SUBMITTER (EMAIL)",
    });
    expect(start.status).toBe(400);
  });

  it("imports submissions in chunks, by division", async () => {
    const { superadmin, editionBase, runImport, conferenceId } = await setup();
    const { job } = await runImport("submissions", submissionsCsv(450));
    expect(job.status).toBe("done");
    expect(job.totalChunks).toBe(3);
    expect(job.counts).toMatchObject({ records: 450, submissions: 450, created: 450, withoutDivision: 150 });
    expect(job.warnings.some((w: string) => w.includes("Health Communication"))).toBe(true);

    const summary = await json(await superadmin(`${editionBase}/summary`));
    expect(summary.submissions).toBe(450);
    expect(summary.submissionsWithoutDivision).toBe(150);
    expect(summary.divisions.map((d: any) => [d.name, d.submissions])).toEqual([
      ["Computational Methods", 150],
      ["Political Communication", 150],
    ]);

    // the shared co-author is one person
    const db = createDb(env.DB);
    const [{ n }] = (await db.all<{ n: number }>(sql`select count(*) as n from persons where conference_id = ${conferenceId}`)) as [{ n: number }];
    expect(n).toBe(451);
  });

  it("is safe to run again, and resets embeddings of changed texts only", async () => {
    const { runImport, editionId } = await setup();
    await runImport("submissions", submissionsCsv(2));
    const db = createDb(env.DB);
    await db.run(sql`update submissions set embedding = x'00000000' where edition_id = ${editionId}`);

    const changed = submissionsCsv(2).replace("Abstract 0", "Changed abstract");
    const { job } = await runImport("submissions", changed);
    expect(job.counts).toMatchObject({ created: 0, updated: 2, newPersons: 0 });
    const rows = await db.all<{ external_id: string; has: number }>(
      sql`select external_id, embedding is not null as has from submissions where edition_id = ${editionId} order by external_id`,
    );
    expect(rows).toEqual([
      { external_id: "1000", has: 0 },
      { external_id: "1001", has: 1 },
    ]);
  });

  it("links reviewers to divisions through keywords, and authors by email", async () => {
    const { superadmin, base, editionBase, runImport } = await setup();
    await runImport("submissions", submissionsCsv(1));
    const { job } = await runImport("reviewers", reviewersCsv);
    expect(job.error).toBeNull();
    expect(job.status).toBe("done");
    // author0 is already known from the submissions: the Person ID is added to them
    expect(job.counts).toMatchObject({ reviewers: 2, newPersons: 1 });

    const keywords = await json(await superadmin(`${base}/keywords`));
    const orphan = keywords.find((k: any) => k.text === "Health Communication: vaccines");
    expect(orphan.divisionId).toBeNull();
    expect(keywords.filter((k: any) => k.divisionId !== null)).toHaveLength(2);

    let summary = await json(await superadmin(`${editionBase}/summary`));
    expect(summary.divisionLoad).toEqual([
      { divisions: 0, reviewers: 1 },
      { divisions: 2, reviewers: 1 },
    ]);

    // assign the orphan keyword by hand
    const divisions = await json(await superadmin(`${base}/divisions`));
    const political = divisions.find((d: any) => d.name === "Political Communication");
    await superadmin(`${base}/keywords/${orphan.id}`, {
      method: "PATCH",
      body: { divisionId: political.id },
    });
    summary = await json(await superadmin(`${editionBase}/summary`));
    expect(summary.divisions.find((d: any) => d.id === political.id).reviewers).toBe(2);
  });

  it("records an email that belongs to someone else as a conflict, once", async () => {
    const { superadmin, base, runImport } = await setup();
    const persons = "PERSON (ID),PERSON (EMAIL)\np1,a@uni.edu\n";
    await runImport("persons", persons);
    const other = "PERSON (ID),PERSON (EMAIL)\np9,a@uni.edu\n";
    const { job } = await runImport("persons", other);
    expect(job.counts).toMatchObject({ newPersons: 1, conflicts: 1 });
    await runImport("persons", other);

    const conflicts = await json(await superadmin(`${base}/conflicts`));
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ kind: "email", value: "a@uni.edu" });
    expect(conflicts[0].incoming.identifiers).toEqual([{ kind: "platform_id", value: "p9" }]);

    await superadmin(`${base}/conflicts/${conflicts[0].id}/resolve`, {
      method: "POST",
      body: { action: "move" },
    });
    expect(await json(await superadmin(`${base}/conflicts`))).toEqual([]);
  });

  it("only lets conference admins import", async () => {
    const { superadmin, base, editionBase } = await setup();
    await superadmin(`${base}/users`, {
      method: "POST",
      body: { email: "planner@example.com", role: "planner" },
    });
    const planner = await signIn("planner@example.com");
    const res = await planner(`${editionBase}/imports?kind=persons&filename=p.csv`, {
      file: "PERSON (ID),PERSON (EMAIL)\n1,a@b.c\n",
    });
    expect(res.status).toBe(403);
    expect((await planner(`${editionBase}/summary`)).status).toBe(200);
  });
});
