// A synthetic demo conference for development: no real people or
// submissions. Emails are fake (demo.*) at real university domains, so the
// institution resolver has something to do.

const DIVISIONS = {
  "Computational Methods": [
    "computational text analysis", "topic models", "large language models", "automated content analysis",
    "network analysis", "digital trace data", "web scraping", "word embeddings", "machine learning classifiers",
    "agent-based simulation",
  ],
  "Political Communication": [
    "election campaigns", "political polarization", "populist rhetoric", "news exposure", "misinformation",
    "political trust", "agenda setting", "partisan media", "voter mobilization", "political advertising",
  ],
  "Health Communication": [
    "vaccine hesitancy", "health messaging", "risk perception", "patient provider communication", "health literacy",
    "smoking cessation campaigns", "mental health stigma", "pandemic information", "fear appeals", "health apps",
  ],
  "Journalism Studies": [
    "newsroom practices", "journalistic norms", "local news", "news avoidance", "fact checking", "press freedom",
    "source selection", "audience metrics", "investigative reporting", "news business models",
  ],
} as const;
type Division = keyof typeof DIVISIONS;
export const DEMO_DIVISIONS = Object.keys(DIVISIONS) as Division[];

const METHODS = ["survey data", "a content analysis", "in-depth interviews", "an online experiment", "panel data", "a computational analysis"];
const UNITS = ["countries", "news outlets", "platforms", "campaigns", "communities", "time points"];
const UNIVERSITIES = [
  "uva.nl", "vu.nl", "ox.ac.uk", "umich.edu", "uzh.ch", "nus.edu.sg", "unimelb.edu.au", "utoronto.ca",
  "lmu.de", "uchile.cl", "uct.ac.za", "sciencespo.fr",
];
const FIRST = ["alex", "sam", "noor", "li", "maria", "jonas", "aisha", "pedro", "yuki", "emma", "kofi", "ines", "omar", "sara", "lena", "tariq"];
const LAST = ["jansen", "smith", "chen", "garcia", "mueller", "okafor", "tanaka", "rossi", "kowalski", "haddad", "silva", "nguyen"];

/** deterministic random numbers (mulberry32) */
function random(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const csvCell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const csvRow = (cells: string[]) => cells.map(csvCell).join(",");
const capitalize = (s: string) => s[0]!.toUpperCase() + s.slice(1);

interface Person {
  index: number;
  email: string;
  home: Division;
  institutionText: string;
}

export function demoData() {
  const rand = random(42);
  const pick = <T>(items: readonly T[]) => items[Math.floor(rand() * items.length)]!;

  const people: Person[] = Array.from({ length: 120 }, (_, index) => {
    const first = pick(FIRST);
    const last = pick(LAST);
    const domain = pick(UNIVERSITIES);
    // some use webmail, so only the institution text says where they are
    const webmail = rand() < 0.1;
    return {
      index,
      email: `demo.${first}.${last}.${index}@${webmail ? "gmail.com" : domain}`,
      home: DEMO_DIVISIONS[index % DEMO_DIVISIONS.length]!,
      institutionText: webmail ? "Independent researcher" : `Department of Communication, ${domain}`,
    };
  });

  function abstract(division: Division) {
    const topics = DIVISIONS[division];
    // a third of the papers borrow a topic from another division
    const other = rand() < 0.33 ? DIVISIONS[pick(DEMO_DIVISIONS)] : topics;
    const t = () => pick(topics);
    return [
      `This study examines ${t()} in the context of ${pick(other)}.`,
      `Drawing on ${pick(METHODS)}, we analyze ${t()} across ${2 + Math.floor(rand() * 20)} ${pick(UNITS)}.`,
      `Results show that ${t()} is associated with ${t()}.`,
      `We discuss implications for ${t()} and ${pick(other)}.`,
    ].join(" ");
  }

  function submissions(count: number, firstId: number) {
    const rows = [csvRow(["CONTROL ID", "TITLE", "ABSTRACT BODY", "AUTHOR (E-mail)", "INSTITUTIONS (ALL)", "CURRENT CATEGORY"])];
    for (let i = 0; i < count; i++) {
      const division = DEMO_DIVISIONS[i % DEMO_DIVISIONS.length]!;
      const title = `${capitalize(pick(DIVISIONS[division]))} and ${pick(DIVISIONS[division])}`;
      const text = abstract(division);
      const nAuthors = 1 + Math.floor(rand() * 3);
      const local = people.filter((p) => p.home === division);
      const authors = new Set<Person>();
      while (authors.size < nAuthors) authors.add(rand() < 0.85 ? pick(local) : pick(people));
      for (const a of authors)
        rows.push(csvRow([String(firstId + i), title, text, a.email, a.institutionText, division]));
    }
    return rows.join("\n");
  }

  function reviewers() {
    const rows = [csvRow(["PERSON (ID)", "PERSON (EMAIL)", "PERSON (AREA OF EXPERTISE)", "STUDENT", "REVIEWER"])];
    for (const p of people.slice(0, 100)) {
      const divisions = new Set<string>([p.home]);
      if (rand() < 0.2) divisions.add(pick(DEMO_DIVISIONS));
      if (rand() < 0.05) divisions.add(pick(DEMO_DIVISIONS));
      const keywords = [...divisions].map((d) =>
        rand() < 0.5 ? d : `${d}: ${pick(DIVISIONS[d as Division])}`,
      );
      // a few keywords of a division that is not in the conference
      if (rand() < 0.05) keywords.push("Game Studies: esports");
      rows.push(
        csvRow([
          `D${1000 + p.index}`,
          p.email,
          keywords.join("; "),
          rand() < 0.15 ? "Yes" : "No",
          rand() < 0.05 ? "No" : "Yes",
        ]),
      );
    }
    return rows.join("\n");
  }

  return {
    divisions: DEMO_DIVISIONS,
    previousSubmissions: submissions(60, 9000),
    submissions: submissions(160, 10000),
    reviewers: reviewers(),
  };
}
