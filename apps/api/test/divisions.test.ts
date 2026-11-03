import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { drainTestQueue } from "../src/imports/process";
import { signIn } from "./helpers";

const json = async (res: Response) => (await res.json()) as any;
const subsHeader = "CONTROL ID,TITLE,ABSTRACT BODY,AUTHOR (E-mail),INSTITUTIONS (ALL),CURRENT CATEGORY";
const revHeader = "PERSON (ID),PERSON (EMAIL),PERSON (AREA OF EXPERTISE)";

async function setup() {
  const admin = await signIn("super@example.com");
  const conference = await json(
    await admin("/api/conferences", { method: "POST", body: { name: "ICA", platform: "scholarone", preset: "ica" } }),
  );
  const base = `/api/conferences/${conference.id}`;
  const cm = await json(await admin(`${base}/divisions`, { method: "POST", body: { name: "Computational Methods" } }));
  const pc = await json(await admin(`${base}/divisions`, { method: "POST", body: { name: "Political Communication" } }));
  const e2026 = await json(await admin(`${base}/editions`, { method: "POST", body: { name: "2026" } }));
  const e2027 = await json(await admin(`${base}/editions`, { method: "POST", body: { name: "2027" } }));
  await admin(`${base}/users`, {
    method: "POST",
    body: { email: "planner@example.com", role: "planner", divisionIds: [cm.id] },
  });

  async function runImport(user: typeof admin, editionId: number, kind: string, text: string, divisionId?: number) {
    const q = `kind=${kind}&filename=f.csv${divisionId ? `&divisionId=${divisionId}` : ""}`;
    const res = await user(`${base}/editions/${editionId}/imports?${q}`, { file: text });
    if (res.status !== 201) return res.status;
    const { job } = await json(res);
    await user(`${base}/editions/${editionId}/imports/${job.id}/start`, { method: "POST", body: { mapping: job.mapping } });
    await drainTestQueue(env);
    return 201;
  }

  await runImport(admin, e2026.id, "submissions", [subsHeader, "900,T,A,r1@x.org,,Political Communication"].join("\n"));
  await runImport(
    admin,
    e2027.id,
    "submissions",
    [subsHeader, "1,T,A,r1@x.org,,Computational Methods", "2,T,A,r3@x.org,,Political Communication"].join("\n"),
  );
  await runImport(
    admin,
    e2027.id,
    "reviewers",
    [
      revHeader,
      "p1,r1@x.org,Computational Methods",
      "p2,r2@x.org,Computational Methods; Political Communication",
      "p3,r3@x.org,Political Communication",
    ].join("\n"),
  );

  const planner = await signIn("planner@example.com");
  const cmBase = `${base}/editions/${e2027.id}/divisions/${cm.id}`;
  const pcBase = `${base}/editions/${e2027.id}/divisions/${pc.id}`;
  const pool = async (user = admin, divisionBase = cmBase) =>
    (await json(await user(`${divisionBase}/reviewers`))) as any[];
  return { admin, planner, base, cm, pc, e2026, e2027, cmBase, pcBase, pool, runImport };
}

const emailsOf = (pool: any[], excluded = false) =>
  pool.filter((r) => r.excluded === excluded).map((r) => r.emails[0]);

describe("division reviewer pool", () => {
  it("contains the reviewers linked by keyword, with details", async () => {
    const { pool } = await setup();
    const reviewers = await pool();
    expect(emailsOf(reviewers)).toEqual(["r1@x.org", "r2@x.org"]);
    const r2 = reviewers.find((r) => r.emails[0] === "r2@x.org");
    expect(r2).toMatchObject({ platformId: "p2", divisions: 2, sources: ["keyword"], authorHere: false });
    expect(reviewers.find((r) => r.emails[0] === "r1@x.org").authorHere).toBe(true);
  });

  it("lets planners exclude and include keyword reviewers, for their division only", async () => {
    const { planner, admin, base, e2027, cmBase, pcBase, pool } = await setup();
    const r2 = (await pool()).find((r) => r.emails[0] === "r2@x.org");
    expect((await planner(`${cmBase}/reviewers/${r2.reviewerId}`, { method: "DELETE" })).status).toBe(200);
    expect(emailsOf(await pool(), true)).toEqual(["r2@x.org"]);
    // still in the other division
    expect(emailsOf(await pool(admin, pcBase))).toContain("r2@x.org");
    const summary = await json(await admin(`${base}/editions/${e2027.id}/summary`));
    expect(summary.divisions.find((d: any) => d.name === "Computational Methods").reviewers).toBe(1);

    await planner(`${cmBase}/reviewers/${r2.reviewerId}/include`, { method: "POST" });
    expect(emailsOf(await pool())).toContain("r2@x.org");

    // planners can view other divisions, not edit them
    expect((await planner(`${pcBase}/reviewers`)).status).toBe(200);
    expect((await planner(`${pcBase}/reviewers`, { method: "POST", body: { email: "a@b.cd" } })).status).toBe(403);
  });

  it("lets planners add and remove reviewers by email", async () => {
    const { planner, cmBase, pool } = await setup();
    const res = await planner(`${cmBase}/reviewers`, { method: "POST", body: { email: "New@X.org" } });
    expect(res.status).toBe(201);
    const added = (await pool()).find((r) => r.emails[0] === "new@x.org");
    expect(added).toMatchObject({ sources: ["planner"], platformId: null, excluded: false });
    await planner(`${cmBase}/reviewers/${added.reviewerId}`, { method: "DELETE" });
    expect((await pool()).some((r) => r.emails[0] === "new@x.org")).toBe(false);
  });

  it("lets planners import a reviewer list for their own division only", async () => {
    const { planner, cm, pc, e2027, runImport, pool } = await setup();
    const list = [revHeader, "p9,r9@x.org,", "p3,r3@x.org,Political Communication"].join("\n");
    expect(await runImport(planner, e2027.id, "reviewers", list, pc.id)).toBe(403);
    // the persons matching list is allowed (it only adds missing person IDs)
    expect(await runImport(planner, e2027.id, "submissions", list)).toBe(403);
    expect(await runImport(planner, e2027.id, "reviewers", list, cm.id)).toBe(201);
    const reviewers = await pool();
    expect(emailsOf(reviewers)).toEqual(["r1@x.org", "r2@x.org", "r3@x.org", "r9@x.org"]);
    expect(reviewers.find((r) => r.emails[0] === "r3@x.org").sources.sort()).toEqual(["planner"]);
  });
});

describe("reference sources", () => {
  it("count own submissions in the selected divisions and editions", async () => {
    const { planner, cm, pc, e2026, e2027, cmBase, pool } = await setup();
    const r1 = () => pool().then((p) => p.find((r) => r.emails[0] === "r1@x.org").ownSubmissions);
    expect(await r1()).toBe(1); // their CM submission in 2027

    const patch = (referenceSources: object) =>
      planner(cmBase, { method: "PATCH", body: { referenceSources } });
    expect((await patch({ divisionIds: [cm.id], editionIds: [] })).status).toBe(400); // itself
    expect((await patch({ divisionIds: [], editionIds: [e2027.id] })).status).toBe(400); // the current edition
    expect((await patch({ divisionIds: [pc.id], editionIds: [e2026.id] })).status).toBe(200);
    expect(await r1()).toBe(2); // + their 2026 submission
    expect((await json(await planner(cmBase))).referenceSources).toEqual({ divisionIds: [pc.id], editionIds: [e2026.id] });
  });
});

describe("join link", () => {
  it("lets anyone with the link join the division's pool", async () => {
    const { planner, cmBase, pool } = await setup();
    const settings = await json(await planner(cmBase));
    const url = (token: string) => `/api/join/${settings.divisionEditionId}?token=${token}`;

    expect((await app.request(url("wrong"), {}, env)).status).toBe(404);
    const info = await json(await app.request(url(settings.joinToken), {}, env));
    expect(info).toMatchObject({ division: "Computational Methods", edition: "2027", joined: false, signedInAs: null });

    const joiner = await signIn("joiner@x.org");
    const join = await joiner(`/api/join/${settings.divisionEditionId}`, {
      method: "POST",
      body: { token: settings.joinToken, student: true },
    });
    expect(join.status).toBe(200);
    expect((await json(await joiner(url(settings.joinToken)))).joined).toBe(true);
    expect((await pool()).find((r) => r.emails[0] === "joiner@x.org")).toMatchObject({
      sources: ["join_link"],
      student: true,
    });

    // a new token invalidates the old link
    await planner(`${cmBase}/join-token`, { method: "POST" });
    expect((await app.request(url(settings.joinToken), {}, env)).status).toBe(404);
  });

  it("hides the join token from people who cannot edit the division", async () => {
    const { admin, base, pcBase } = await setup();
    await admin(`${base}/users`, { method: "POST", body: { email: "viewer@example.com", role: "planner" } });
    const viewer = await signIn("viewer@example.com");
    expect((await json(await viewer(pcBase))).joinToken).toBeNull();
  });
});
