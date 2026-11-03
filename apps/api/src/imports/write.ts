// Writes one chunk of parsed records to the database. Every write is an
// upsert, so re-running an import is safe.

import { and, eq, inArray, sql } from "drizzle-orm";
import type { ScholarOneSettings } from "@cp/adapter-scholarone";
import type { PersonRecord, ReviewerRecord, SubmissionRecord } from "@cp/shared";
import {
  divisions,
  reviewerKeywords,
  reviewers,
  submissionAuthors,
  submissions,
  type Db,
} from "@cp/db";
import { chunkRows, chunkValues } from "./d1";
import { recomputeKeywordDivisions, upsertKeywords } from "./keywords";
import { resolvePersons, type ImportContext } from "./persons";

export interface ChunkResult {
  counts: Record<string, number>;
  warnings: string[];
}

const normalizeKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

function randomSecret() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function writeSubmissions(
  db: Db,
  ctx: ImportContext,
  records: SubmissionRecord[],
): Promise<ChunkResult> {
  // divisions by their platform key (e.g. the CURRENT CATEGORY value)
  const divisionRows = await db
    .select({ id: divisions.id, key: divisions.platformKey, name: divisions.name })
    .from(divisions)
    .where(eq(divisions.conferenceId, ctx.conferenceId));
  const divisionByKey = new Map(
    divisionRows.map((d) => [normalizeKey(d.key || d.name), d.id] as const),
  );

  const authors = records.flatMap((r) => r.authors);
  const resolved = await resolvePersons(
    db,
    ctx,
    "author",
    authors.map((a) => ({ personId: a.personId, emails: [a.email], institution: a.institution })),
  );

  const existing = new Set<string>();
  for (const part of chunkValues(records.map((r) => r.externalId))) {
    const rows = await db
      .select({ externalId: submissions.externalId })
      .from(submissions)
      .where(and(eq(submissions.editionId, ctx.editionId), inArray(submissions.externalId, part)));
    for (const r of rows) existing.add(r.externalId);
  }

  const unknownDivisions = new Map<string, number>();
  const upserts = records.map((r) => {
    const divisionId = r.divisionKey ? divisionByKey.get(normalizeKey(r.divisionKey)) : undefined;
    if (r.divisionKey && divisionId === undefined)
      unknownDivisions.set(r.divisionKey, (unknownDivisions.get(r.divisionKey) ?? 0) + 1);
    return db
      .insert(submissions)
      .values({
        editionId: ctx.editionId,
        externalId: r.externalId,
        title: r.title,
        abstract: r.abstract,
        divisionId: divisionId ?? null,
        status: r.status ?? null,
      })
      .onConflictDoUpdate({
        target: [submissions.editionId, submissions.externalId],
        set: {
          title: sql`excluded.title`,
          abstract: sql`excluded.abstract`,
          divisionId: sql`excluded.division_id`,
          status: sql`excluded.status`,
          // the embedding is recomputed only if the text changed
          embedding: sql`case when ${submissions.title} = excluded.title and ${submissions.abstract} = excluded.abstract then ${submissions.embedding} else null end`,
        },
      })
      .returning({ id: submissions.id });
  });
  const inserted = records.length > 0 ? await db.batch(upserts as [any, ...any[]]) : [];
  const submissionIds = inserted.map((rows) => (rows as { id: number }[])[0]!.id);

  // replace the authors
  for (const part of chunkValues(submissionIds))
    await db.delete(submissionAuthors).where(inArray(submissionAuthors.submissionId, part));
  let a = 0;
  const authorRows = records.flatMap((r, i) =>
    r.authors.map((author) => ({
      submissionId: submissionIds[i]!,
      personId: resolved.ids[a++]!,
      position: author.position,
      institution: author.institution || null,
    })),
  );
  for (const part of chunkRows(authorRows, 4))
    await db.insert(submissionAuthors).values(part).onConflictDoNothing();

  return {
    counts: {
      submissions: records.length,
      created: records.filter((r) => !existing.has(r.externalId)).length,
      updated: records.filter((r) => existing.has(r.externalId)).length,
      newPersons: resolved.created,
      conflicts: resolved.conflicts,
      withoutDivision: records.filter((r) => !r.divisionKey).length +
        [...unknownDivisions.values()].reduce((a, b) => a + b, 0),
    },
    warnings: [...unknownDivisions].map(
      ([key]) => `Division "${key}" is not in the conference. Add it, and import again to assign these submissions`,
    ),
  };
}

export async function writePersons(
  db: Db,
  ctx: ImportContext,
  records: PersonRecord[],
): Promise<ChunkResult> {
  const resolved = await resolvePersons(db, ctx, "persons", records);
  return {
    counts: { persons: records.length, newPersons: resolved.created, conflicts: resolved.conflicts },
    warnings: [],
  };
}

export async function writeReviewers(
  db: Db,
  ctx: ImportContext,
  records: ReviewerRecord[],
  settings: ScholarOneSettings,
): Promise<ChunkResult> {
  const resolved = await resolvePersons(
    db,
    ctx,
    "reviewer",
    records.map((r) => r.person),
  );
  const keywordIds = await upsertKeywords(
    db,
    ctx.conferenceId,
    records.flatMap((r) => r.person.keywords),
    settings.reviewers.keywordSeparator,
  );

  const upserts = records.map((r, i) =>
    db
      .insert(reviewers)
      .values({
        editionId: ctx.editionId,
        personId: resolved.ids[i]!,
        student: r.student,
        canReview: r.willingToReview,
        source: "import",
        secret: randomSecret(),
      })
      .onConflictDoUpdate({
        target: [reviewers.editionId, reviewers.personId],
        set: { student: sql`excluded.student`, canReview: sql`excluded.can_review` },
      })
      .returning({ id: reviewers.id }),
  );
  const inserted = records.length > 0 ? await db.batch(upserts as [any, ...any[]]) : [];
  const reviewerIds = inserted.map((rows) => (rows as { id: number }[])[0]!.id);

  // replace the reviewers' keywords, then their keyword division links
  for (const part of chunkValues(reviewerIds))
    await db.delete(reviewerKeywords).where(inArray(reviewerKeywords.reviewerId, part));
  const links = records.flatMap((r, i) =>
    [...new Set(r.person.keywords)].map((k) => ({
      reviewerId: reviewerIds[i]!,
      keywordId: keywordIds.get(k)!,
    })),
  );
  for (const part of chunkRows(links, 2))
    await db.insert(reviewerKeywords).values(part).onConflictDoNothing();
  await recomputeKeywordDivisions(db, reviewerIds);

  return {
    counts: {
      reviewers: records.length,
      newPersons: resolved.created,
      conflicts: resolved.conflicts,
      withoutKeywords: records.filter((r) => r.person.keywords.length === 0).length,
    },
    warnings: [],
  };
}
