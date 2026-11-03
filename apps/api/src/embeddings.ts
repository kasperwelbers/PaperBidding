import { DEV_HASH_MODEL, EMBEDDING_MODELS, devHashEmbedding, type EmbeddingLanguage } from "@cp/shared";

export interface Embedder {
  /** stored with every embedding; only same-model embeddings are compared */
  model: string;
  /** at most `batchSize` texts at a time */
  embed(texts: string[]): Promise<number[][]>;
  batchSize: number;
}

// bge-base-en reads up to 512 tokens, so longer texts are cut; bge-m3 reads
// much longer texts
const MAX_CHARS = { english: 2000, multilingual: 8000 };

function workersAiEmbedder(ai: Ai, language: EmbeddingLanguage): Embedder {
  const model = EMBEDDING_MODELS[language];
  return {
    model,
    batchSize: 100,
    async embed(texts) {
      const result = (await (ai.run as (model: string, input: unknown) => Promise<unknown>)(model, {
        text: texts.map((t) => t.slice(0, MAX_CHARS[language])),
      })) as { data?: number[][] };
      if (!result.data || result.data.length !== texts.length)
        throw new Error("Workers AI returned no embeddings");
      return result.data;
    },
  };
}

const devHashEmbedder: Embedder = {
  model: DEV_HASH_MODEL,
  batchSize: 100,
  async embed(texts) {
    return texts.map(devHashEmbedding);
  },
};

const isDevelopment = (env: Env) =>
  env.ENVIRONMENT === "development" || env.ENVIRONMENT === "test";

/** Workers AI in production, with the conference's language choice. In
 *  development and tests the local stand-in, unless EMBEDDINGS = "workers-ai"
 *  (`pnpm dev:remote-ai`) */
export function getEmbedder(env: Env, language: EmbeddingLanguage = "english"): Embedder {
  const choice = env.EMBEDDINGS || (isDevelopment(env) ? "dev-hash" : "workers-ai");
  if (choice === "dev-hash") {
    if (!isDevelopment(env))
      throw new Error("The dev-hash stand-in embedder is only for development");
    return devHashEmbedder;
  }
  if (choice === "workers-ai") return workersAiEmbedder(env.AI, language);
  throw new Error(`Unknown EMBEDDINGS: ${choice}`);
}
