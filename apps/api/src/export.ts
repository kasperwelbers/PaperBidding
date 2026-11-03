// Exporting assignments to the platform: every assigned reviewer needs a
// platform person ID.

import { and, eq, inArray } from "drizzle-orm";
import { importConflicts, personIdentifiers, persons, reviewers, submissions, type Db } from "@cp/db";
import type { Assigned } from "@cp/shared";
import { chunkValues } from "./imports/d1";

export async function exportStatus(db: Db, result: Record<number, Assigned[]>) {
  const reviewerIds = [...new Set(Object.values(result).flatMap((l) => l.map((a) => a.reviewerId)))];
  const submissionIds = Object.keys(result).map(Number);

  const info = new Map<
    number,
    { personId: number; source: string; exportPersonId: string | null; name: string | null; emails: string[]; platformId: string | null }
  >();
  for (const part of chunkValues(reviewerIds, 80)) {
    const rows = await db
      .select({
        id: reviewers.id,
        personId: reviewers.personId,
        source: reviewers.source,
        exportPersonId: reviewers.exportPersonId,
        name: persons.name,
      })
      .from(reviewers)
      .innerJoin(persons, eq(persons.id, reviewers.personId))
      .where(inArray(reviewers.id, part));
    const ids = await db
      .select()
      .from(personIdentifiers)
      .where(inArray(personIdentifiers.personId, rows.map((r) => r.personId)))
      .orderBy(personIdentifiers.id);
    for (const r of rows)
      info.set(r.id, {
        ...r,
        emails: ids.filter((i) => i.personId === r.personId && i.kind === "email").map((i) => i.value),
        platformId: ids.find((i) => i.personId === r.personId && i.kind === "platform_id")?.value ?? null,
      });
  }

  const externalIds = new Map<number, string>();
  for (const part of chunkValues(submissionIds))
    for (const s of await db
      .select({ id: submissions.id, externalId: submissions.externalId })
      .from(submissions)
      .where(inArray(submissions.id, part)))
      externalIds.set(s.id, s.externalId);

  const personIdOf = (reviewerId: number) => {
    const r = info.get(reviewerId);
    return r?.exportPersonId || r?.platformId || null;
  };
  const rows: { personId: string; externalSubmissionId: string }[] = [];
  const unmatched = new Map<number, string[]>();
  for (const [submissionId, list] of Object.entries(result))
    for (const a of list) {
      const personId = personIdOf(a.reviewerId);
      const externalId = externalIds.get(Number(submissionId)) ?? "?";
      if (personId) rows.push({ personId, externalSubmissionId: externalId });
      else unmatched.set(a.reviewerId, [...(unmatched.get(a.reviewerId) ?? []), externalId]);
    }

  return {
    assigned: reviewerIds.length,
    matched: reviewerIds.filter((id) => personIdOf(id)).length,
    rows,
    unmatched: [...unmatched].map(([reviewerId, externalIds]) => {
      const r = info.get(reviewerId);
      return {
        reviewerId,
        email: r?.emails[0] ?? null,
        name: r?.name ?? null,
        source: r?.source ?? null,
        /** for assigning by hand in the platform */
        submissions: externalIds.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })),
      };
    }),
  };
}

/** Sets a reviewer's person ID by hand. If nobody has it yet, it's added to
 *  the person (a proper fix). If it belongs to another person, it's only used
 *  for this reviewer's export, and recorded as a conflict for the admin */
export async function setPersonId(
  db: Db,
  args: { conferenceId: number; reviewerId: number; platformId: string },
) {
  const reviewer = await db.query.reviewers.findFirst({ where: eq(reviewers.id, args.reviewerId) });
  if (!reviewer) return null;
  const owner = await db.query.personIdentifiers.findFirst({
    where: and(
      eq(personIdentifiers.conferenceId, args.conferenceId),
      eq(personIdentifiers.kind, "platform_id"),
      eq(personIdentifiers.value, args.platformId),
    ),
  });
  if (!owner || owner.personId === reviewer.personId) {
    if (!owner)
      await db.insert(personIdentifiers).values({
        conferenceId: args.conferenceId,
        personId: reviewer.personId,
        kind: "platform_id",
        value: args.platformId,
      });
    await db.update(reviewers).set({ exportPersonId: null }).where(eq(reviewers.id, reviewer.id));
    return { added: true as const };
  }
  await db.update(reviewers).set({ exportPersonId: args.platformId }).where(eq(reviewers.id, reviewer.id));
  await db
    .insert(importConflicts)
    .values({
      conferenceId: args.conferenceId,
      kind: "platform_id",
      value: args.platformId,
      existingPersonId: owner.personId,
      incomingPersonId: reviewer.personId,
    })
    .onConflictDoNothing();
  return { added: false as const };
}
