import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { defaultMatchingSettings } from "@cp/shared";
import { eq } from "drizzle-orm";
import { createDb, reviewers } from "@cp/db";
import { app } from "../src/app";
import { drainTestQueue } from "../src/imports/process";
import { signIn } from "./helpers";

const json = async (res: Response) => (await res.json()) as any;
const settings = { ...defaultMatchingSettings, reviewersPerSubmission: 2 };

/** The demo conference (reviewers have person IDs), plus a reviewer added by
 *  hand without a person ID, who bid on everything so they get assignments */
async function setup() {
  const admin = await signIn("super@example.com");
  const { conferenceId, editionId } = await json(await admin("/api/dev/demo", { method: "POST" }));
  await drainTestQueue(env);
  const base = `/api/conferences/${conferenceId}`;
  const cm = (await json(await admin(`${base}/divisions`))).find((d: any) => d.name === "Computational Methods");
  const divisionBase = `${base}/editions/${editionId}/divisions/${cm.id}`;
  await admin(`${divisionBase}/reviewers`, { method: "POST", body: { email: "no.id@example.org" } });
  const extra = (await json(await admin(`${divisionBase}/reviewers`))).find((r: any) => r.emails[0] === "no.id@example.org");

  // the extra reviewer bids, so they certainly get assignments
  await admin(divisionBase, { method: "PATCH", body: { biddingDeadline: new Date(Date.now() + 86400000).toISOString() } });
  const { divisionEditionId } = await json(await admin(divisionBase));
  const db = createDb(env.DB);
  const { secret } = (await db.query.reviewers.findFirst({ where: eq(reviewers.id, extra.reviewerId) }))!;
  const headers = { "Content-Type": "application/json", "X-Bidding-Token": `${extra.reviewerId}.${secret}` };
  const list = await json(await app.request(`/api/bidding/${divisionEditionId}`, { headers }, env));
  await app.request(
    `/api/bidding/${divisionEditionId}/bids`,
    { method: "PUT", headers, body: JSON.stringify({ submissionIds: list.submissions.slice(0, 2).map((s: any) => s.id) }) },
    env,
  );

  const compute = () => admin(`${divisionBase}/assignments`, { method: "POST", body: { settings } });
  const status = async () => json(await admin(`${divisionBase}/assignments/export`));
  return { admin, base, editionId, divisionBase, extra, compute, status };
}

describe("export", () => {
  it("writes the ScholarOne file with the matched assignments, and locks", async () => {
    const { admin, divisionBase, compute, status } = await setup();
    await compute();
    const before = await status();
    const unmatchedCount = before.unmatched.reduce((n: number, u: any) => n + u.submissions.length, 0);

    const res = await admin(`${divisionBase}/assignments/export`, { method: "POST" });
    expect(res.headers.get("content-type")).toContain("text/csv");
    expect(res.headers.get("content-disposition")).toContain("reviewer_assignments.csv");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]); // UTF-8 BOM
    const lines = new TextDecoder().decode(bytes).replace(/^﻿/, "").trim().split("\n");
    expect(lines[0]).toBe("Person ID,Control ID");
    expect(lines.length - 1).toBe(40 * 2 - unmatchedCount);
    expect(lines.slice(1).every((l) => /^D\d+,\d+$/.test(l))).toBe(true);

    expect((await status()).exportedAt).not.toBeNull();
    expect((await compute()).status).toBe(409);
  });

  it("lists assigned reviewers without a person ID, and fixes them by hand", async () => {
    const { admin, divisionBase, extra, compute, status } = await setup();
    await compute();
    let s = await status();
    const missing = s.unmatched.find((u: any) => u.reviewerId === extra.reviewerId);
    expect(missing).toMatchObject({ email: "no.id@example.org", source: "planner" });
    expect(missing.submissions.length).toBeGreaterThanOrEqual(2); // their 2 bids, plus a fair share
    expect(s.matched).toBe(s.assigned - 1);

    await admin(`${divisionBase}/assignments/person-id`, {
      method: "POST",
      body: { reviewerId: extra.reviewerId, personId: "NEW-1" },
    });
    s = await status();
    expect(s.unmatched.some((u: any) => u.reviewerId === extra.reviewerId)).toBe(false);
    expect(s.matched).toBe(s.assigned);
  });

  it("uses a person ID of someone else only for the export, and records a conflict", async () => {
    const { admin, base, divisionBase, extra, compute, status } = await setup();
    await compute();
    const res = await json(
      await admin(`${divisionBase}/assignments/person-id`, {
        method: "POST",
        body: { reviewerId: extra.reviewerId, personId: "D1000" }, // a demo reviewer's ID
      }),
    );
    expect(res).toEqual({ added: false });
    const conflicts = await json(await admin(`${base}/import-conflicts`));
    expect(conflicts.some((c: any) => c.kind === "platform_id" && c.value === "D1000")).toBe(true);
    // the export uses it for this reviewer
    const s = await status();
    expect(s.unmatched).toEqual([]);
    const file = await (await admin(`${divisionBase}/assignments/export`, { method: "POST" })).text();
    expect(file.split("\n").filter((l) => l.startsWith("D1000,")).length).toBeGreaterThanOrEqual(2);
  });

  it("lets planners upload the matching list", async () => {
    const { admin, base, editionId } = await setup();
    await admin(`${base}/users`, { method: "POST", body: { email: "planner@example.com", role: "planner" } });
    const planner = await signIn("planner@example.com");
    const res = await planner(`${base}/editions/${editionId}/imports?kind=persons&filename=p.csv`, {
      file: "PERSON (ID),PERSON (EMAIL)\nNEW-2,no.id@example.org\n",
    });
    expect(res.status).toBe(201);
  });
});
