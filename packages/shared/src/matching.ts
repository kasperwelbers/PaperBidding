// Assigning reviewers to submissions. Ported from the legacy app
// (legacy/src/app/projects/[project]/manage/assignments/makeAssignments.ts):
//
// 1. Every reviewer has a preference list: their bids first, then the most
//    similar submissions they may review. Similarity matches get the no-bid
//    penalty added to their rank, so bids come first.
// 2. Submissions take turns picking their best remaining candidate, so the
//    first submissions don't get all the best matches. At most
//    maxStudentReviewers students per submission. Candidates that are left
//    become backups.
// 3. Submissions that still have too few reviewers get the least busy
//    reviewers that may review them.
// 4. Balancing: overloaded reviewers give their weakest matches to backups
//    with fewer assignments.
//
// Changes from the legacy version: works on ids; conflicts come from the
// caller (conflictReason); the optional division share; fixes for balancing
// (the replaced reviewer's count went down), filling (no empty reviewers,
// students are counted), and keeps backups and how each assignment was made.

export interface MatchingSettings {
  reviewersPerSubmission: number;
  maxStudentReviewers: number;
  /** added to the rank of similarity matches, so bids come first */
  noBidPenalty: number;
  includeWho: "all" | "authors" | "authors or bidders";
  /** reviewers in k divisions get 1/k of a normal number of assignments */
  divisionShare: boolean;
}

export const defaultMatchingSettings: MatchingSettings = {
  reviewersPerSubmission: 3,
  maxStudentReviewers: 1,
  noBidPenalty: 5,
  includeWho: "all",
  divisionShare: true,
};

export interface MatchingReviewer {
  id: number;
  student: boolean;
  /** author of a submission in this division (for includeWho) */
  author: boolean;
  /** number of divisions they review for (for divisionShare) */
  divisions: number;
  /** bids, most preferred first */
  bids: number[];
  /** submissions they may review, most similar first (no conflicts) */
  ranked: number[];
}

export interface Assigned {
  reviewerId: number;
  /** bid: from a bid; similarity: from similarity; filled: no match left;
   *  replacement: a backup that replaced someone */
  method: "bid" | "similarity" | "filled" | "replacement";
  /** position in the reviewer's preference list (1 = best), if any */
  rank: number | null;
  student: boolean;
}

export interface MatchingResult {
  /** submission id -> assigned reviewers */
  assignments: Record<number, Assigned[]>;
  /** submission id -> backup reviewer ids, best first */
  backups: Record<number, number[]>;
  /** reviewers that were not included (includeWho) */
  skipped: number[];
}

const MAX_PREFERENCES = 500;

/** deterministic tie breaker */
function mix(a: number, b: number) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35);
  h ^= h >>> 15;
  return (Math.imul(h, 0x27d4eb2d) >>> 0) / 4294967296;
}

interface Candidate {
  reviewerId: number;
  method: "bid" | "similarity";
  rank: number;
  penalizedRank: number;
  student: boolean;
  order: number;
}

export function matchReviewers(
  submissionIds: number[],
  allReviewers: MatchingReviewer[],
  settings: MatchingSettings,
): MatchingResult {
  const { reviewersPerSubmission, maxStudentReviewers } = settings;
  const included = allReviewers.filter((r) => {
    if (settings.includeWho === "authors") return r.author;
    if (settings.includeWho === "authors or bidders") return r.author || r.bids.length > 0;
    return true;
  });
  const skipped = allReviewers.filter((r) => !included.includes(r)).map((r) => r.id);
  const reviewerById = new Map(included.map((r) => [r.id, r]));
  const submissionSet = new Set(submissionIds);
  const allowed = new Map(included.map((r) => [r.id, new Set(r.ranked)]));
  const mayReview = (reviewerId: number, submissionId: number) =>
    allowed.get(reviewerId)?.has(submissionId) ?? false;

  // 1. candidates per submission, from each reviewer's preference list
  const candidates = new Map<number, Candidate[]>(submissionIds.map((id) => [id, []]));
  for (const r of included) {
    const bids = r.bids.filter((id) => submissionSet.has(id) && mayReview(r.id, id));
    const preferences = [...bids, ...r.ranked.filter((id) => !bids.includes(id))].slice(0, MAX_PREFERENCES);
    preferences.forEach((submissionId, i) => {
      const method = i < bids.length ? "bid" : "similarity";
      candidates.get(submissionId)?.push({
        reviewerId: r.id,
        method,
        rank: i + 1,
        penalizedRank: method === "bid" ? i + 1 : i + 1 + settings.noBidPenalty,
        student: r.student,
        order: mix(r.id, submissionId),
      });
    });
  }
  for (const list of candidates.values())
    list.sort((a, b) => a.penalizedRank - b.penalizedRank || a.order - b.order);

  // 2. submissions take turns picking their best remaining candidate
  const assigned = new Map<number, (Assigned & { penalizedRank: number })[]>(submissionIds.map((id) => [id, []]));
  const backups = new Map<number, Candidate[]>(submissionIds.map((id) => [id, []]));
  const load = new Map<number, number>(included.map((r) => [r.id, 0]));
  const students = (id: number) => assigned.get(id)!.filter((a) => a.student).length;
  const order = [...submissionIds].sort((a, b) => mix(a, 7) - mix(b, 7));
  const ready = new Set<number>();

  while (ready.size < order.length) {
    for (const id of order) {
      if (ready.has(id)) continue;
      const list = candidates.get(id)!;
      if (assigned.get(id)!.length >= reviewersPerSubmission || list.length === 0) {
        backups.get(id)!.push(...list);
        list.length = 0;
        ready.add(id);
        continue;
      }
      const candidate = list.shift()!;
      if (candidate.student && students(id) >= maxStudentReviewers) {
        backups.get(id)!.push(candidate);
        continue;
      }
      assigned.get(id)!.push({
        reviewerId: candidate.reviewerId,
        method: candidate.method,
        rank: candidate.rank,
        student: candidate.student,
        penalizedRank: candidate.penalizedRank,
      });
      load.set(candidate.reviewerId, load.get(candidate.reviewerId)! + 1);
    }
  }

  // 3. fill submissions that have too few reviewers with the least busy
  // reviewers that may review them
  for (const id of submissionIds) {
    const list = assigned.get(id)!;
    while (list.length < reviewersPerSubmission) {
      const pick = included
        .filter(
          (r) =>
            mayReview(r.id, id) &&
            !list.some((a) => a.reviewerId === r.id) &&
            !(r.student && students(id) >= maxStudentReviewers),
        )
        .sort((a, b) => load.get(a.id)! - load.get(b.id)! || mix(a.id, id) - mix(b.id, id))[0];
      if (!pick) break; // nobody left who may review it
      list.push({ reviewerId: pick.id, method: "filled", rank: null, student: pick.student, penalizedRank: 9999 });
      load.set(pick.id, load.get(pick.id)! + 1);
    }
  }

  // 4. balance: the maximum number of assignments per reviewer
  const total = submissionIds.length * reviewersPerSubmission;
  const nStudents = included.filter((r) => r.student).length;
  const shareOf = (r: MatchingReviewer) => (settings.divisionShare ? 1 / Math.max(1, r.divisions) : 1);
  const totalShare = included.reduce((sum, r) => sum + shareOf(r), 0) || 1;
  const maxStudentTotal = submissionIds.length * Math.min(maxStudentReviewers, reviewersPerSubmission);
  const maxFor = (r: MatchingReviewer) => {
    const fair = Math.ceil((total * shareOf(r)) / totalShare);
    return r.student && nStudents > 0 ? Math.min(fair, Math.ceil(maxStudentTotal / nStudents)) : fair;
  };
  const tooMany = (reviewerId: number) => load.get(reviewerId)! - maxFor(reviewerById.get(reviewerId)!);

  // weakest matches of the most overloaded reviewers first
  const overloaded = submissionIds
    .flatMap((id) => assigned.get(id)!.map((a) => ({ id, a })))
    .filter(({ a }) => tooMany(a.reviewerId) > 0)
    .sort((x, y) => y.a.penalizedRank - x.a.penalizedRank || tooMany(y.a.reviewerId) - tooMany(x.a.reviewerId));

  for (const { id, a } of overloaded) {
    if (tooMany(a.reviewerId) <= 0) continue;
    const list = assigned.get(id)!;
    const i = list.findIndex((x) => x.reviewerId === a.reviewerId);
    if (i === -1) continue;
    const studentsWithout = students(id) - (a.student ? 1 : 0);
    const replacement = backups
      .get(id)!
      .filter(
        (b) =>
          !list.some((x) => x.reviewerId === b.reviewerId) &&
          load.get(b.reviewerId)! < maxFor(reviewerById.get(b.reviewerId)!) &&
          !(b.student && studentsWithout >= maxStudentReviewers),
      )
      .sort((x, y) => load.get(x.reviewerId)! - load.get(y.reviewerId)! || x.penalizedRank - y.penalizedRank)[0];
    if (!replacement) continue;
    list[i] = {
      reviewerId: replacement.reviewerId,
      method: replacement.method,
      rank: replacement.rank,
      student: replacement.student,
      penalizedRank: replacement.penalizedRank,
    };
    load.set(a.reviewerId, load.get(a.reviewerId)! - 1);
    load.set(replacement.reviewerId, load.get(replacement.reviewerId)! + 1);
    // the replaced reviewer becomes a backup
    const bl = backups.get(id)!.filter((b) => b.reviewerId !== replacement.reviewerId);
    bl.push({ reviewerId: a.reviewerId, method: a.method === "bid" ? "bid" : "similarity", rank: a.rank ?? 999, penalizedRank: a.penalizedRank, student: a.student, order: 0 });
    backups.set(id, bl);
  }

  const result: MatchingResult = { assignments: {}, backups: {}, skipped };
  for (const id of submissionIds) {
    const list = assigned.get(id)!;
    result.assignments[id] = list.map(({ penalizedRank: _, ...a }) => a);
    result.backups[id] = backups
      .get(id)!
      .filter((b) => !list.some((a) => a.reviewerId === b.reviewerId))
      .sort((x, y) => x.penalizedRank - y.penalizedRank)
      .map((b) => b.reviewerId)
      .filter((rid, i, all) => all.indexOf(rid) === i);
  }
  return result;
}

/** Replaces one reviewer of a submission with the best backup that isn't
 *  assigned to it yet (and keeps the student limit). Returns the new reviewer
 *  id, or null if there is no backup. Changes `result` in place */
export function replaceReviewer(
  result: MatchingResult,
  submissionId: number,
  reviewerId: number,
  reviewers: Map<number, { student: boolean }>,
  settings: Pick<MatchingSettings, "maxStudentReviewers">,
  /** reviewers that may not be picked (e.g. the one who dropped out) */
  unavailable: Set<number> = new Set(),
): number | null {
  const list = result.assignments[submissionId];
  if (!list) return null;
  const i = list.findIndex((a) => a.reviewerId === reviewerId);
  if (i === -1) return null;
  const studentsWithout = list.filter((a, j) => j !== i && a.student).length;
  const backupList = result.backups[submissionId] ?? [];
  const pick = backupList.find(
    (id) =>
      id !== reviewerId &&
      !unavailable.has(id) &&
      !list.some((a) => a.reviewerId === id) &&
      !(reviewers.get(id)?.student && studentsWithout >= settings.maxStudentReviewers),
  );
  if (pick === undefined) return null;
  list[i] = { reviewerId: pick, method: "replacement", rank: null, student: reviewers.get(pick)?.student ?? false };
  result.backups[submissionId] = backupList.filter((id) => id !== pick && id !== reviewerId);
  return pick;
}
