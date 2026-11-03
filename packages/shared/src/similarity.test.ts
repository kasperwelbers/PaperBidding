import { describe, expect, it } from "vitest";
import {
  blobToEmbedding,
  cosineSimilarity,
  embeddingToBlob,
  meanSimilarity,
  rankBySimilarity,
} from "./similarity";

describe("cosineSimilarity", () => {
  it("is 1 for the same direction and 0 for orthogonal vectors", () => {
    expect(cosineSimilarity([1, 2], [2, 4])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
  });
  it("is NaN for vectors of different length", () => {
    expect(cosineSimilarity([1], [1, 2])).toBeNaN();
  });
});

describe("meanSimilarity", () => {
  it("is 0 without own submissions", () => {
    expect(meanSimilarity([1, 0], [])).toBe(0);
  });
  it("averages over own submissions", () => {
    expect(meanSimilarity([1, 0], [[1, 0], [0, 1]])).toBeCloseTo(0.5);
  });
});

describe("rankBySimilarity", () => {
  it("puts the most similar submission first", () => {
    const ranked = rankBySimilarity(
      [
        { id: "far", embedding: [0, 1] },
        { id: "close", embedding: [1, 0.1] },
      ],
      [[1, 0]],
    );
    expect(ranked.map((s) => s.id)).toEqual(["close", "far"]);
  });
});

describe("embedding blobs", () => {
  it("round-trips through a blob", () => {
    const blob = embeddingToBlob([0.5, -1, 2]);
    expect([...blobToEmbedding(blob)]).toEqual([0.5, -1, 2]);
    expect([...blobToEmbedding(new Uint8Array(blob))]).toEqual([0.5, -1, 2]);
  });
});
