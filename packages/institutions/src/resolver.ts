// Best guess of a person's institution, from their email domain and/or the
// institution text in an export. Ported from the legacy app
// (legacy/src/hooks/useInstitutionResolver.tsx), and improved:
// - parent domains match too (student.uva.nl -> uva.nl)
// - webmail domains (gmail.com etc.) are never used
// - name matching uses an index instead of checking every university, and
//   prefers the most specific match
// - per-conference aliases (a spelling -> an institution) come first

export type University = [name: string, country: string, domains: string[]];

export interface Resolved {
  /** best guess, or null if nothing is known */
  name: string | null;
  country?: string;
  via: "alias" | "domain" | "name" | "raw" | "none";
}

const WEBMAIL = new Set([
  "gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "msn.com",
  "yahoo.com", "ymail.com", "icloud.com", "me.com", "mac.com", "aol.com", "proton.me",
  "protonmail.com", "gmx.com", "gmx.de", "gmx.net", "web.de", "mail.com", "zoho.com",
  "yandex.com", "yandex.ru", "mail.ru", "qq.com", "163.com", "126.com", "foxmail.com",
  "naver.com", "hanmail.net", "daum.net",
]);

// generic words that don't identify a university on their own
const GENERIC = new Set([
  "university", "of", "the", "and", "college", "institute", "school", "de", "da", "di",
  "del", "la", "le", "des", "du", "for", "in", "at", "technology", "science", "sciences",
  "state", "national",
]);

/** lowercase words; "u" and "uni" mean university */
export function words(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .split(" ")
    .filter(Boolean)
    .map((w) => (w === "u" || w === "uni" ? "university" : w));
}

export function normalizeInstitution(text: string) {
  return words(text).join(" ");
}

export interface Resolver {
  /** aliases: normalized raw text -> institution (per conference) */
  resolve(input: { email?: string; raw?: string }, aliases?: Map<string, string>): Resolved;
  /** whether a name is in the university list */
  isKnown(name: string): boolean;
}

export function createResolver(universities: University[]): Resolver {
  const names = new Set(universities.map((u) => u[0]));
  const byDomain = new Map<string, University>();
  for (const u of universities) for (const d of u[2]) if (!byDomain.has(d)) byDomain.set(d, u);

  // name index: each university under its rarest distinctive word
  const entries = universities.map((u) => ({ u, words: [...new Set(words(u[0]))] }));
  const frequency = new Map<string, number>();
  for (const e of entries) for (const w of e.words) frequency.set(w, (frequency.get(w) ?? 0) + 1);
  const byWord = new Map<string, typeof entries>();
  for (const e of entries) {
    const distinctive = e.words.filter((w) => !GENERIC.has(w));
    if (distinctive.length === 0) continue; // e.g. "State University": too vague
    const key = distinctive.reduce((a, b) => (frequency.get(a)! <= frequency.get(b)! ? a : b));
    const list = byWord.get(key) ?? [];
    list.push(e);
    byWord.set(key, list);
  }

  function fromDomain(email: string) {
    let domain = email.split("@")[1]?.trim().toLowerCase();
    if (!domain || WEBMAIL.has(domain)) return undefined;
    // try the domain and its parents, but not bare top-level domains like ac.uk
    while (domain && domain.split(".").length >= 2) {
      const u = byDomain.get(domain);
      if (u) return u;
      domain = domain.slice(domain.indexOf(".") + 1);
    }
    return undefined;
  }

  function fromName(raw: string) {
    const input = new Set(words(raw));
    let best: (typeof entries)[number] | undefined;
    for (const w of input)
      for (const e of byWord.get(w) ?? [])
        if (e.words.every((x) => input.has(x)) && (!best || e.words.length > best.words.length))
          best = e;
    return best?.u;
  }

  return {
    isKnown: (name) => names.has(name),
    resolve({ email = "", raw = "" }, aliases) {
      const alias = raw && aliases ? aliases.get(normalizeInstitution(raw)) : undefined;
      if (alias) return { name: alias, via: "alias" };
      const d = fromDomain(email);
      if (d) return { name: d[0], country: d[1], via: "domain" };
      const n = raw ? fromName(raw) : undefined;
      if (n) return { name: n[0], country: n[1], via: "name" };
      const text = raw.trim();
      return text ? { name: text, via: "raw" } : { name: null, via: "none" };
    },
  };
}
