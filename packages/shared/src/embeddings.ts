// Embeddings record the model that made them, and are only compared with
// embeddings of the same model.

export const WORKERS_AI_MODEL = "@cf/baai/bge-small-en-v1.5";
export const DEV_HASH_MODEL = "dev-hash-384";
export const EMBEDDING_DIMENSIONS = 384;

/** The text that is embedded for a submission */
export function submissionText(s: { title: string; abstract: string }) {
  return `${s.title}.\n\n${s.abstract}`;
}

const STOPWORDS = new Set(
  ("a an and are as at be by for from has have in into is it its of on or our that the their " +
    "this to was we were which with these those than then also not can may using use used study " +
    "studies paper research results findings")
    .split(" "),
);

/** 32-bit FNV-1a hash */
function hash(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A lexical stand-in for development without Workers AI: feature hashing of
 * words and word pairs into 384 dimensions (log term frequency, L2
 * normalized). Not semantic, but texts that share words are similar, so the
 * whole flow can be tested locally. Never used in production.
 */
export function devHashEmbedding(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const words = text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const counts = new Map<string, number>();
  for (let i = 0; i < words.length; i++) {
    counts.set(words[i]!, (counts.get(words[i]!) ?? 0) + 1);
    if (i > 0) counts.set(`${words[i - 1]} ${words[i]}`, (counts.get(`${words[i - 1]} ${words[i]}`) ?? 0) + 1);
  }
  for (const [feature, n] of counts) {
    const h = hash(feature);
    // the sign comes from another bit, so collisions tend to cancel out
    vector[h % EMBEDDING_DIMENSIONS]! += (h & 0x80000000 ? -1 : 1) * (1 + Math.log(n));
  }
  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}
