// Ported from the legacy app (legacy/src/lib/computeRelevantSubmissions.ts)

export type Embedding = ArrayLike<number>;

export function cosineSimilarity(a: Embedding, b: Embedding): number {
  if (a.length === 0 || a.length !== b.length) return Number.NaN;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    dot += x * y;
    normA += x * x;
    normB += y * y;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

/** Mean similarity of a submission to a reviewer's own submissions. 0 if the
 *  reviewer has none.
 *  (The legacy app divided by n - 1. That's a constant factor per reviewer, so
 *  it never changed a ranking) */
export function meanSimilarity(
  embedding: Embedding,
  ownEmbeddings: Embedding[],
): number {
  if (ownEmbeddings.length === 0) return 0;
  let sum = 0;
  for (const own of ownEmbeddings) {
    const sim = cosineSimilarity(embedding, own);
    if (!Number.isNaN(sim)) sum += sim;
  }
  return sum / ownEmbeddings.length;
}

/** Rank submissions by similarity to a reviewer's own submissions, most
 *  similar first. Does not change the input */
export function rankBySimilarity<T extends { embedding: Embedding }>(
  submissions: T[],
  ownEmbeddings: Embedding[],
): (T & { similarity: number })[] {
  return submissions
    .map((s) => ({ ...s, similarity: meanSimilarity(s.embedding, ownEmbeddings) }))
    .sort((a, b) => b.similarity - a.similarity);
}

/** Embeddings are stored in D1 as blobs of float32 values */
export function embeddingToBlob(embedding: Embedding): ArrayBuffer {
  return Float32Array.from(embedding).buffer;
}

export function blobToEmbedding(blob: ArrayBuffer | Uint8Array): Float32Array {
  if (blob instanceof Uint8Array)
    return new Float32Array(blob.buffer, blob.byteOffset, blob.byteLength / 4);
  return new Float32Array(blob);
}
