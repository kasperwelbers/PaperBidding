import { env } from "cloudflare:workers";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { conflictReason, defaultMatchingSettings } from "@cp/shared";
import { createDb, editions, reviewers } from "@cp/db";
import { app } from "../src/app";
import { drainTestQueue } from "../src/imports/process";
import { loadConflictReviewers, loadConflictSubmissions } from "../src/review-conflicts";
import { signIn } from "./helpers";

const json = async (res: Response) => (await res.json()) as any;
const settings = { ...defaultMatchingSettings };

/** The demo conference, and the Computational Methods division in 2027 */
async function setup() {
  const admin = await signIn("super@example.com");
  const { conferenceId, editionId } = await json(await admin("/api/dev/demo", { method: "POST" }));
  await drainTestQueue(env);
  const base = `/api/conferences/${conferenceId}`;
  const divisions = await json(await admin(`${base}/divisions`));
  const cm = divisions.find((d: any) => d.name === "Computational Methods");
  const divisionBase = `${base}/editions/${editionId}/divisions/${cm.id}`;
  const compute = (s = settings) => admin(`${divisionBase}/assignments`, { method: "POST", body: { settings: s } });
  const view = async () => json(await admin(`${divisionBase}/assignments`));
  return { admin, base, conferenceId, editionId, divisionBase, compute, view };
}

describe("assignments", () => {
  it("assigns reviewers to every submission, without conflicts", async () => {
    const { compute, view, conferenceId, editionId } = await setup();
    const res = await compute();
    expect(res.status).toBe(200);
    const summary = await json(res);
    expect(summary).toMatchObject({ submissions: 40, short: 0 });

    const result = await view();
    expect(result.submissions).toHaveLength(40);
    for (const s of result.submissions) {
      expect(s.reviewers).toHaveLength(3);
      expect(s.reviewers.filter((r: any) => r.student).length).toBeLessThanOrEqual(1);
    }

    // check every assignment against the conflict rules
    const db = createDb(env.DB);
    const edition = (await db.query.editions.findFirst({ where: eq(editions.id, editionId) }))!;
    const conference = (await db.query.conferences.findFirst({ where: (c, { eq }) => eq(c.id, conferenceId) }))!;
    const rows = await db.query.reviewers.findMany({ where: eq(reviewers.editionId, editionId) });
    const personOf = new Map(rows.map((r) => [r.id, r.personId]));
    const conflictReviewers = await loadConflictReviewers(db, edition, rows.map((r) => r.personId));
    const conflictSubmissions = await loadConflictSubmissions(db, result.submissions.map((s: any) => s.id));
    for (const s of result.submissions)
      for (const r of s.reviewers)
        expect(
          conflictReason(
            conflictReviewers.get(personOf.get(r.reviewerId)!)!,
            conflictSubmissions.get(s.id)!,
            conference.conflictRules,
          ),
        ).toBeNull();
  });

  it("uses bids", async () => {
    const { admin, divisionBase, compute, view } = await setup();
    await admin(divisionBase, { method: "PATCH", body: { biddingDeadline: new Date(Date.now() + 86400000).toISOString() } });
    // a reviewer bids on the last submission of their list
    const pool = await json(await admin(`${divisionBase}/reviewers`));
    const reviewer = pool.find((r: any) => !r.excluded && r.canReview && !r.student);
    const { divisionEditionId } = await json(await admin(divisionBase));
    const db = createDb(env.DB);
    const { secret } = (await db.query.reviewers.findFirst({ where: eq(reviewers.id, reviewer.reviewerId) }))!;
    const headers = { "Content-Type": "application/json", "X-Bidding-Token": `${reviewer.reviewerId}.${secret}` };
    const list = await json(await app.request(`/api/bidding/${divisionEditionId}`, { headers }, env));
    const target = list.submissions.at(-1).id;
    await app.request(
      `/api/bidding/${divisionEditionId}/bids`,
      { method: "PUT", headers, body: JSON.stringify({ submissionIds: [target] }) },
      env,
    );

    await compute();
    const assigned = (await view()).submissions.find((s: any) => s.id === target);
    expect(assigned.reviewers.find((r: any) => r.reviewerId === reviewer.reviewerId)).toMatchObject({
      method: "bid",
      rank: 1,
    });
  });

  it("replaces a reviewer without changing other assignments", async () => {
    const { admin, divisionBase, compute, view } = await setup();
    await compute();
    const before = await view();
    const busiest = before.reviewers[0].reviewerId;
    const res = await json(
      await admin(`${divisionBase}/assignments/replace`, { method: "POST", body: { reviewerId: busiest } }),
    );
    expect(res.replaced.length).toBe(before.reviewers[0].count);
    expect(res.replaced.every((r: any) => r.by !== null)).toBe(true);

    const after = await view();
    for (const s of after.submissions) {
      expect(s.reviewers.some((r: any) => r.reviewerId === busiest)).toBe(false);
      const old = before.submissions.find((b: any) => b.id === s.id);
      const kept = s.reviewers.filter((r: any) => r.method !== "replacement").map((r: any) => r.reviewerId);
      expect(old.reviewers.map((r: any) => r.reviewerId)).toEqual(expect.arrayContaining(kept));
    }
  });

  it("can't be recomputed after export (lock), until unlocked", async () => {
    const { admin, divisionBase, compute } = await setup();
    await compute();
    await admin(`${divisionBase}/assignments/lock`, { method: "POST" });
    expect((await compute()).status).toBe(409);
    await admin(`${divisionBase}/assignments/unlock`, { method: "POST" });
    expect((await compute()).status).toBe(200);
  });

  it("remembers the settings, and only lets the division's planners compute", async () => {
    const { admin, base, divisionBase, compute, view } = await setup();
    await compute({ ...settings, reviewersPerSubmission: 2 });
    expect((await view()).settings.reviewersPerSubmission).toBe(2);
    expect((await json(await admin(divisionBase))).divisionEditionId).toBeTypeOf("number");

    await admin(`${base}/users`, { method: "POST", body: { email: "other@example.com", role: "planner" } });
    const other = await signIn("other@example.com");
    const res = await other(`${divisionBase}/assignments`, { method: "POST", body: { settings } });
    expect(res.status).toBe(403);
    expect((await other(`${divisionBase}/assignments`)).status).toBe(200);
  });
});
