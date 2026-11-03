import { describe, expect, it } from "vitest";
import { defaultMatchingSettings, matchReviewers, replaceReviewer, type MatchingReviewer } from "./matching";

const submissions = Array.from({ length: 30 }, (_, i) => i + 1);

/** reviewers who may review everything, ranked by a simple pattern */
function reviewers(n: number, extra: Partial<MatchingReviewer> = {}): MatchingReviewer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: 100 + i,
    student: false,
    author: true,
    divisions: 1,
    bids: [],
    ranked: [...submissions].sort((a, b) => ((a * (i + 3)) % 31) - ((b * (i + 3)) % 31)),
    ...extra,
  }));
}

const settings = { ...defaultMatchingSettings, divisionShare: false };
const loads = (result: ReturnType<typeof matchReviewers>) => {
  const load = new Map<number, number>();
  for (const list of Object.values(result.assignments))
    for (const a of list) load.set(a.reviewerId, (load.get(a.reviewerId) ?? 0) + 1);
  return load;
};

describe("matchReviewers", () => {
  it("assigns the number of reviewers per submission, without duplicates", () => {
    const result = matchReviewers(submissions, reviewers(20), settings);
    for (const id of submissions) {
      const ids = result.assignments[id]!.map((a) => a.reviewerId);
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
    }
  });

  it("balances the load", () => {
    const load = loads(matchReviewers(submissions, reviewers(20), settings));
    // 90 assignments over 20 reviewers: at most ceil(4.5) = 5 each
    expect(Math.max(...load.values())).toBeLessThanOrEqual(5);
  });

  it("never assigns a submission a reviewer may not review", () => {
    const rs = reviewers(20).map((r) => ({ ...r, ranked: r.ranked.filter((id) => id !== 1) }));
    rs[0]!.ranked.push(1); // only reviewer 100 may review submission 1
    const result = matchReviewers(submissions, rs, settings);
    expect(result.assignments[1]!.map((a) => a.reviewerId)).toEqual([100]);
  });

  it("puts bids before similarity", () => {
    const rs = reviewers(20);
    rs[5]!.bids = [7];
    const result = matchReviewers(submissions, rs, settings);
    expect(result.assignments[7]!.find((a) => a.reviewerId === 105)).toMatchObject({ method: "bid", rank: 1 });
  });

  it("assigns at most maxStudentReviewers students per submission", () => {
    const rs = [...reviewers(10, { student: true }), ...reviewers(10).map((r) => ({ ...r, id: r.id + 50 }))];
    const result = matchReviewers(submissions, rs, settings);
    for (const id of submissions)
      expect(result.assignments[id]!.filter((a) => a.student).length).toBeLessThanOrEqual(1);
  });

  it("gives reviewers in several divisions a smaller share", () => {
    const rs = reviewers(20);
    for (const r of rs.slice(0, 5)) r.divisions = 3;
    const load = loads(matchReviewers(submissions, rs, { ...settings, divisionShare: true }));
    const multi = rs.slice(0, 5).map((r) => load.get(r.id) ?? 0);
    const single = rs.slice(5).map((r) => load.get(r.id) ?? 0);
    expect(Math.max(...multi)).toBeLessThan(Math.min(...single));
  });

  it("only includes authors when asked", () => {
    const rs = reviewers(20);
    rs[0]!.author = false;
    const result = matchReviewers(submissions, rs, { ...settings, includeWho: "authors" });
    expect(result.skipped).toEqual([100]);
    expect(loads(result).has(100)).toBe(false);
  });

  it("is deterministic", () => {
    expect(matchReviewers(submissions, reviewers(20), settings)).toEqual(
      matchReviewers(submissions, reviewers(20), settings),
    );
  });

  it("keeps backups, to replace a reviewer without recomputing", () => {
    const rs = reviewers(20);
    const result = matchReviewers(submissions, rs, settings);
    const before = structuredClone(result.assignments);
    const out = result.assignments[3]![0]!.reviewerId;
    const byId = new Map(rs.map((r) => [r.id, r]));
    const replacement = replaceReviewer(result, 3, out, byId, settings, new Set([out]));
    expect(replacement).not.toBeNull();
    expect(result.assignments[3]!.map((a) => a.reviewerId)).not.toContain(out);
    expect(result.assignments[3]![0]).toMatchObject({ reviewerId: replacement, method: "replacement" });
    // nothing else changed
    for (const id of submissions) if (id !== 3) expect(result.assignments[id]).toEqual(before[id]);
  });
});
