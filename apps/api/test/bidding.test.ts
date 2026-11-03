import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { sentTestEmails } from "../src/email";
import { drainTestQueue } from "../src/imports/process";
import { signIn } from "./helpers";

const json = async (res: Response) => (await res.json()) as any;
const subsHeader = "CONTROL ID,TITLE,ABSTRACT BODY,AUTHOR (E-mail),INSTITUTIONS (ALL),CURRENT CATEGORY";
const CM = "Computational Methods";

async function setup() {
  const admin = await signIn("super@example.com");
  const conference = await json(
    await admin("/api/conferences", { method: "POST", body: { name: "ICA", platform: "scholarone", preset: "ica" } }),
  );
  const base = `/api/conferences/${conference.id}`;
  const cm = await json(await admin(`${base}/divisions`, { method: "POST", body: { name: CM } }));
  await admin(`${base}/divisions`, { method: "POST", body: { name: "Political Communication" } });
  const edition = await json(await admin(`${base}/editions`, { method: "POST", body: { name: "2027" } }));
  const editionBase = `${base}/editions/${edition.id}`;

  async function runImport(kind: string, text: string) {
    const { job } = await json(await admin(`${editionBase}/imports?kind=${kind}&filename=f.csv`, { file: text }));
    await admin(`${editionBase}/imports/${job.id}/start`, { method: "POST", body: { mapping: job.mapping } });
    await drainTestQueue(env);
  }
  await runImport(
    "submissions",
    [
      subsHeader,
      `1,Content analysis of news with language models,Automated content analysis of news articles with large language models,r1@uva.nl,,${CM}`,
      `1,Content analysis of news with language models,Automated content analysis of news articles with large language models,co@x.org,,${CM}`,
      `2,Co-author paper,Something by the co-author,co@x.org,,${CM}`,
      `3,Same institution paper,Something from the same institution,y@uva.nl,,${CM}`,
      `4,Topic models of news,Computational analysis of news articles with topic models and language models,z@x.org,,${CM}`,
      `5,Vaccine messaging,Vaccine hesitancy and health messaging during the pandemic,w@x.org,,${CM}`,
      `6,Other division,Election campaigns,v@x.org,,Political Communication`,
    ].join("\n"),
  );
  await runImport(
    "reviewers",
    ["PERSON (ID),PERSON (EMAIL),PERSON (AREA OF EXPERTISE)", `p1,r1@uva.nl,${CM}`, `p9,r9@x.org,${CM}`].join("\n"),
  );

  const divisionBase = `${editionBase}/divisions/${cm.id}`;
  const info = await json(await admin(divisionBase));
  const setDeadline = (date: Date | null) =>
    admin(divisionBase, { method: "PATCH", body: { biddingDeadline: date?.toISOString() ?? null } });
  const pool = async () => (await json(await admin(`${divisionBase}/reviewers`))) as any[];

  /** invites everyone not invited yet, and returns email -> bidding link */
  async function invite() {
    const template = await json(await admin(`${divisionBase}/invitations/template`));
    const res = await admin(`${divisionBase}/invitations`, { method: "POST", body: template });
    const sent = sentTestEmails.length;
    await drainTestQueue(env);
    const links: Record<string, string> = {};
    for (const mail of sentTestEmails.slice(sent))
      links[mail.to] = mail.text.match(/https?:\/\/\S+\/bid\/\S+/)![0];
    return { res, links };
  }
  return { admin, base, divisionBase, deId: info.divisionEditionId as number, joinToken: info.joinToken, setDeadline, pool, invite };
}

/** A reviewer's requests with the token from their bidding link */
function withLink(link: string) {
  const [, deId, reviewerId, secret] = link.match(/\/bid\/(\d+)\/(\d+)\/(.+)$/)!;
  const headers = { "Content-Type": "application/json", "X-Bidding-Token": `${reviewerId}.${secret}` };
  return {
    get: (path = "") => app.request(`/api/bidding/${deId}${path}`, { headers }, env),
    bid: (submissionIds: number[]) =>
      app.request(`/api/bidding/${deId}/bids`, { method: "PUT", headers, body: JSON.stringify({ submissionIds }) }, env),
  };
}

const tomorrow = () => new Date(Date.now() + 24 * 3600 * 1000);
const titles = (list: any) => list.submissions.map((s: any) => s.title);

describe("bidding", () => {
  it("is closed until a deadline is set", async () => {
    const { invite } = await setup();
    const { res } = await invite();
    expect(res.status).toBe(400);
  });

  it("shows the division's submissions without conflicts, most similar first", async () => {
    const { setDeadline, invite } = await setup();
    await setDeadline(tomorrow());
    const { res, links } = await invite();
    expect((await json(res)).queued).toBe(2);
    expect(Object.keys(links).sort()).toEqual(["r1@uva.nl", "r9@x.org"]);

    const r1 = await json(await withLink(links["r1@uva.nl"]!).get());
    expect(r1).toMatchObject({ division: CM, open: true, basedOnOwnWork: true, bids: [] });
    // own (1), co-author (2) and same institution (3) are left out
    expect(titles(r1)).toEqual(["Topic models of news", "Vaccine messaging"]);
    expect(r1.submissions[0].similarity).toBeGreaterThan(r1.submissions[1].similarity);

    // without own submissions: everything, in a stable order
    const r9 = withLink(links["r9@x.org"]!);
    const first = await json(await r9.get());
    expect(first.basedOnOwnWork).toBe(false);
    expect(first.submissions).toHaveLength(5);
    expect(titles(await json(await r9.get()))).toEqual(titles(first));
  });

  it("saves bids, and refuses bids on submissions that are not allowed", async () => {
    const { setDeadline, invite } = await setup();
    await setDeadline(tomorrow());
    const r1 = withLink((await invite()).links["r1@uva.nl"]!);
    const list = await json(await r1.get());
    const [topic, vaccine] = list.submissions.map((s: any) => s.id);

    expect((await r1.bid([vaccine, topic])).status).toBe(200);
    expect((await json(await r1.get())).bids).toEqual([vaccine, topic]);
    expect((await r1.bid([topic, 999999])).status).toBe(400);

    const abstract = await json(await r1.get(`/submissions/${topic}`));
    expect(abstract.abstract).toContain("topic models");
  });

  it("closes after the deadline", async () => {
    const { setDeadline, invite } = await setup();
    await setDeadline(tomorrow());
    const r1 = withLink((await invite()).links["r1@uva.nl"]!);
    const [first] = (await json(await r1.get())).submissions;
    await setDeadline(new Date(Date.now() - 1000));
    expect((await r1.bid([first.id])).status).toBe(403);
    expect((await json(await r1.get())).open).toBe(false);
  });

  it("refuses wrong links and reviewers taken out of the division", async () => {
    const { setDeadline, invite, pool, admin, divisionBase } = await setup();
    await setDeadline(tomorrow());
    const link = (await invite()).links["r9@x.org"]!;
    expect((await withLink(link.replace(/[^/]+$/, "wrong")).get()).status).toBe(404);

    const r9 = (await pool()).find((r) => r.emails[0] === "r9@x.org");
    expect(r9).toMatchObject({ bids: 0, invitedAt: expect.any(String) });
    await admin(`${divisionBase}/reviewers/${r9.reviewerId}`, { method: "DELETE" });
    expect((await withLink(link).get()).status).toBe(404);
  });

  it("does not invite anyone twice", async () => {
    const { setDeadline, invite } = await setup();
    await setDeadline(tomorrow());
    await invite();
    expect((await json((await invite()).res)).queued).toBe(0);
  });

  it("lets people who joined via the join link bid when signed in", async () => {
    const { setDeadline, deId, joinToken } = await setup();
    await setDeadline(tomorrow());
    const joiner = await signIn("joiner@x.org");
    await joiner(`/api/join/${deId}`, { method: "POST", body: { token: joinToken, student: false } });
    const list = await json(await joiner(`/api/bidding/${deId}`));
    expect(list.open).toBe(true);
    expect(list.submissions).toHaveLength(5);

    const outsider = await signIn("outsider@x.org");
    expect((await outsider(`/api/bidding/${deId}`)).status).toBe(404);
  });
});
