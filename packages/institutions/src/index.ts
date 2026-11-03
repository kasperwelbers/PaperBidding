import data from "../data/universities.json";
import { createResolver, type University } from "./resolver";

export * from "./resolver";

export const universities = data as unknown as University[];

let cached: ReturnType<typeof createResolver> | undefined;

/** A resolver with the bundled university list (built once) */
export function institutionResolver() {
  cached ??= createResolver(universities);
  return cached;
}

/** Universities whose name contains all words of the query (for picking an
 *  institution by hand) */
export function searchUniversities(query: string, limit = 20) {
  const q = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
  if (q.length === 0) return [];
  const out: { name: string; country: string }[] = [];
  for (const [name, country] of universities) {
    const lower = name.toLowerCase();
    if (q.every((w) => lower.includes(w))) out.push({ name, country });
    if (out.length >= limit) break;
  }
  return out;
}
