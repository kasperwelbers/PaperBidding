import { DEV_HASH_MODEL, WORKERS_AI_MODEL, devHashEmbedding } from "@cp/shared";

export interface Embedder {
  /** stored with every embedding; only same-model embeddings are compared */
  model: string;
  /** at most `batchSize` texts at a time */
  embed(texts: string[]): Promise<number[][]>;
  batchSize: number;
}

// bge-small reads up to 512 tokens; longer abstracts are cut
const MAX_CHARS = 2000;

function workersAiEmbedder(ai: Ai): Embedder {
  return {
    model: WORKERS_AI_MODEL,
    batchSize: 100,
    async embed(texts) {
      const result = (await ai.run(WORKERS_AI_MODEL, {
        text: texts.map((t) => t.slice(0, MAX_CHARS)),
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

/** Workers AI in production. In development and tests the local stand-in,
 *  unless EMBEDDINGS = "workers-ai" (`pnpm dev:remote-ai`) */
export function getEmbedder(env: Env): Embedder {
  const choice = env.EMBEDDINGS || (isDevelopment(env) ? "dev-hash" : "workers-ai");
  if (choice === "dev-hash") {
    if (!isDevelopment(env))
      throw new Error("The dev-hash stand-in embedder is only for development");
    return devHashEmbedder;
  }
  if (choice === "workers-ai") return workersAiEmbedder(env.AI);
  throw new Error(`Unknown EMBEDDINGS: ${choice}`);
}
