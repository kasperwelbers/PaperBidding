import { describe, expect, it } from "vitest";
import { devHashEmbedding, EMBEDDING_DIMENSIONS } from "./embeddings";
import { cosineSimilarity } from "./similarity";

describe("devHashEmbedding", () => {
  const a = devHashEmbedding("Automated content analysis of news with large language models");
  const b = devHashEmbedding("Large language models for automated content analysis");
  const c = devHashEmbedding("Vaccine hesitancy and health messaging on social media");

  it("has the embedding dimensions and unit length", () => {
    expect(a).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(cosineSimilarity(a, a)).toBeCloseTo(1);
  });

  it("is deterministic", () => {
    expect(devHashEmbedding("same text")).toEqual(devHashEmbedding("same text"));
  });

  it("scores texts that share words as more similar", () => {
    expect(cosineSimilarity(a, b)).toBeGreaterThan(cosineSimilarity(a, c) + 0.2);
  });
});
