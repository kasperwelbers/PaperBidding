// Ranking submissions for a reviewer: by similarity to their own work, or a
// stable random order if there's no own work to compare with. Used by both
// the bidding page and the matching, so they agree.

import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { blobToEmbedding, rankBySimilarity } from "@cp/shared";
import { submissionAuthors, submissions, type Db } from "@cp/db";
import { chunkValues } from "./imports/d1";

export interface Candidate {
  id: number;
  title: string;
  embedding: Float32Array | null;
}

/** A stable pseudo-random order, so reviewers without own submissions don't
 *  all see (or get) the same submissions first */
export function stableOrder(reviewerId: number, submissionId: number) {
  let h = Math.imul(reviewerId ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(submissionId, 0xc2b2ae35);
  h ^= h >>> 13;
  return (Math.imul(h, 0x27d4eb2d) >>> 0) / 4294967296;
}

/** Most similar first. Submissions without an embedding come last */
export function rankFor(reviewerId: number, candidates: Candidate[], own: Float32Array[]) {
  const withEmbedding = candidates.filter((c) => c.embedding) as (Candidate & { embedding: Float32Array })[];
  const without = candidates.filter((c) => !c.embedding);
  const ranked =
    own.length > 0
      ? rankBySimilarity(withEmbedding, own).map((c) => ({ id: c.id, title: c.title, similarity: c.similarity as number | null }))
      : withEmbedding
          .map((c) => ({ id: c.id, title: c.title, similarity: null as number | null }))
          .sort((a, b) => stableOrder(reviewerId, a.id) - stableOrder(reviewerId, b.id));
  return [...ranked, ...without.map((c) => ({ id: c.id, title: c.title, similarity: null as number | null }))];
}

/** Candidates: submissions of a division in an edition, with embeddings of
 *  the current model only */
export async function divisionCandidates(db: Db, editionId: number, divisionId: number, model: string) {
  const rows = await db
    .select({ id: submissions.id, title: submissions.title, embedding: submissions.embedding, model: submissions.embeddingModel })
    .from(submissions)
    .where(and(eq(submissions.editionId, editionId), eq(submissions.divisionId, divisionId)));
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    embedding: r.embedding && r.model === model ? blobToEmbedding(r.embedding as Uint8Array) : null,
  }));
}

/** Embeddings of each person's own submissions within a reference scope */
export async function ownEmbeddings(
  db: Db,
  personIds: number[],
  scope: ReturnType<typeof import("./references").referenceScope>,
  model: string,
) {
  const result = new Map<number, Float32Array[]>();
  for (const part of chunkValues([...new Set(personIds)], 80)) {
    const rows = await db
      .selectDistinct({ personId: submissionAuthors.personId, id: submissions.id, embedding: submissions.embedding })
      .from(submissionAuthors)
      .innerJoin(submissions, eq(submissions.id, submissionAuthors.submissionId))
      .where(
        and(
          inArray(submissionAuthors.personId, part),
          scope,
          eq(submissions.embeddingModel, model),
          isNotNull(submissions.embedding),
        ),
      );
    for (const r of rows) {
      const list = result.get(r.personId) ?? [];
      list.push(blobToEmbedding(r.embedding as Uint8Array));
      result.set(r.personId, list);
    }
  }
  return result;
}
