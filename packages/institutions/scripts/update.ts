// Updates data/universities.json from the Hipo university-domains-list
// (https://github.com/Hipo/university-domains-list, MIT license).
// Run by hand: `pnpm --filter @cp/institutions update [commit]`. Without a
// commit, the latest commit of the default branch is used. Commit the result.

import { writeFileSync } from "node:fs";

const repo = "Hipo/university-domains-list";
const commit =
  process.argv[2] ??
  ((await (await fetch(`https://api.github.com/repos/${repo}/commits?per_page=1`)).json()) as { sha: string }[])[0]!.sha;

const url = `https://raw.githubusercontent.com/${repo}/${commit}/world_universities_and_domains.json`;
const res = await fetch(url);
if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`);
const list = (await res.json()) as { name: string; country: string; domains?: string[] }[];

// compact: [name, country, domains]
const compact = list
  .filter((u) => u.name && u.domains?.length)
  .map((u) => [u.name.trim(), u.country, [...new Set(u.domains!.map((d) => d.trim().toLowerCase()))]]);

const dir = new URL("../data/", import.meta.url);
writeFileSync(new URL("universities.json", dir), JSON.stringify(compact));
writeFileSync(
  new URL("SOURCE.md", dir),
  `# Source

\`universities.json\` is a compact version (name, country, email domains) of
\`world_universities_and_domains.json\` from
https://github.com/${repo}, commit \`${commit}\`
(downloaded ${new Date().toISOString().slice(0, 10)}). ${compact.length} universities.

The Hipo list is licensed under the MIT License, copyright (c) Hipo.
Update with \`pnpm --filter @cp/institutions update\`.
`,
);
console.log(`Wrote ${compact.length} universities from ${repo}@${commit}`);
