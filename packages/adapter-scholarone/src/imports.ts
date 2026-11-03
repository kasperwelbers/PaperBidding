import type {
  FieldSpec,
  ImportSpec,
  ParseResult,
  PersonRecord,
  ReviewerRecord,
  SubmissionRecord,
} from "@cp/shared";
import { splitKeywords } from "./keywords";
import type { ScholarOneSettings } from "./settings";

type Row = Record<string, string>;
type Spec<T> = ImportSpec<T, ScholarOneSettings>;

const field = (
  field: string,
  label: string,
  headerAliases: string[],
  required = false,
): FieldSpec => ({ field, label, headerAliases, required });

const normalizeEmail = (email: string) => email.trim().toLowerCase();
const isNo = (value: string | undefined) => /^(no|n|false|0)$/i.test((value ?? "").trim());

// --- submissions ---

/** The submissions export has one row per author (the same CONTROL ID on
 *  several rows) */
export const submissionsImport: Spec<SubmissionRecord> = {
  label: "Submissions",
  instructions: (s) => [
    { text: "In ScholarOne, open the **Admin** tab and go to **Search** (Submissions tab)" },
    s.submissions.savedSearch
      ? {
          text: `Under **Saved Searches**, select *"${s.submissions.savedSearch}"* and click **Actions: Load**`,
        }
      : {
          text: "Select the display items **CONTROL ID**, **TITLE**, **ABSTRACT BODY**, **AUTHORS (ADDRESS & EMAIL)**, **INSTITUTIONS (ALL)** and **ABSTRACT STATUS**",
        },
    {
      text: `Make sure **${s.submissions.divisionColumn}** is included as a display item, so submissions are assigned to divisions`,
    },
    {
      text: "Do **not** filter on a division: import the submissions of all divisions at once",
    },
    { text: "Select the format **Comma delimited**, click **Run**, and upload the file here" },
  ],
  fields: (s) => [
    field("externalId", "Control ID", ["control id"], true),
    field("title", "Title", ["title"], true),
    field("abstract", "Abstract", ["abstract body", "abstract"], true),
    // matches the "(E-mail)" author column, not PRESENTER/SUBMITTER (EMAIL)
    field("authorEmail", "Author email", ["(e-mail)"], true),
    field("authorInstitution", "Author institution", ["institutions (all)", "institution"]),
    field("division", "Division", [s.submissions.divisionColumn.toLowerCase()]),
    field("status", "Status", ["abstract status"]),
  ],
  checkMapping: (mapping) => {
    const authorColumn = (mapping.authorEmail ?? "").toLowerCase();
    if (/presenter|submitter/.test(authorColumn))
      return [
        `"${mapping.authorEmail}" only has the presenter or submitter, not all authors. Use the AUTHORS (ADDRESS & EMAIL) column`,
      ];
    return [];
  },
  parse(rows) {
    const warnings: string[] = [];
    const byId = new Map<string, SubmissionRecord>();
    let skipped = 0;

    for (const row of rows) {
      const externalId = row.externalId ?? "";
      if (!externalId) {
        skipped++;
        continue;
      }
      let submission = byId.get(externalId);
      if (!submission) {
        submission = {
          externalId,
          title: row.title ?? "",
          abstract: row.abstract ?? "",
          divisionKey: row.division || undefined,
          status: row.status || undefined,
          authors: [],
        };
        byId.set(externalId, submission);
      }
      const email = normalizeEmail(row.authorEmail ?? "");
      if (email && !submission.authors.some((a) => a.email === email))
        submission.authors.push({
          email,
          institution: row.authorInstitution ?? "",
          position: submission.authors.length,
        });
    }

    const records = [...byId.values()];
    const untitled = records.filter((r) => !r.title).length;
    const noAuthors = records.filter((r) => r.authors.length === 0).length;
    if (skipped) warnings.push(`${skipped} rows without a Control ID were skipped`);
    if (untitled) warnings.push(`${untitled} submissions have no title`);
    if (noAuthors) warnings.push(`${noAuthors} submissions have no author email`);
    return { records, warnings };
  },
};

// --- persons ---

const personFields = (s: ScholarOneSettings): FieldSpec[] => [
  // "person (id)", so not PERSON (MEMBER ID) or USER ID
  field("personId", "Person ID", ["person (id)"], true),
  field("email", "Email", ["person (email)", "email"], true),
  field("firstName", "First name", ["person (first name)", "first name"]),
  field("lastName", "Last name", ["person (last name)", "last name"]),
  field("institution", "Institution", ["person (institution)", "institution"]),
  field("keywords", "Areas of expertise", [s.reviewers.keywordsColumn.toLowerCase()]),
];

/** Persons exports can have several rows per person (e.g. one per keyword) */
function parsePersons(rows: Row[]): ParseResult<PersonRecord> & { rowsByPerson: Map<PersonRecord, Row[]> } {
  const warnings: string[] = [];
  const byKey = new Map<string, PersonRecord>();
  const rowsByPerson = new Map<PersonRecord, Row[]>();
  let skipped = 0;

  for (const row of rows) {
    const personId = (row.personId ?? "").trim();
    const email = normalizeEmail(row.email ?? "");
    const key = personId ? `id:${personId}` : email ? `email:${email}` : "";
    if (!key) {
      skipped++;
      continue;
    }
    let person = byKey.get(key);
    if (!person) {
      const name = [row.firstName, row.lastName].filter(Boolean).join(" ").trim();
      person = {
        personId: personId || undefined,
        emails: [],
        name: name || undefined,
        institution: row.institution || undefined,
        keywords: [],
      };
      byKey.set(key, person);
      rowsByPerson.set(person, []);
    }
    rowsByPerson.get(person)!.push(row);
    if (email && !person.emails.includes(email)) person.emails.push(email);
    for (const keyword of splitKeywords(row.keywords ?? ""))
      if (!person.keywords.includes(keyword)) person.keywords.push(keyword);
  }

  const records = [...byKey.values()];
  const noId = records.filter((r) => !r.personId).length;
  if (skipped) warnings.push(`${skipped} rows without a Person ID or email were skipped`);
  if (noId)
    warnings.push(
      `${noId} people have no Person ID. They are imported by email, but cannot be exported to ScholarOne until they are matched`,
    );
  return { records, warnings, rowsByPerson };
}

export const personsImport: Spec<PersonRecord> = {
  label: "Persons (email and Person ID)",
  instructions: (s) => [
    { text: "In ScholarOne, open the **Admin** tab, go to **Search** and select the **People** tab" },
    { text: "Do **not** filter on a division or category: the list should be as complete as possible" },
    {
      text: `Select the display items **PERSON (EMAIL)** and **PERSON (ID)**, and optionally the name, institution and **${s.reviewers.keywordsColumn}**`,
    },
    { text: "Select the format **Comma delimited**, click **Run**, and upload the file here" },
  ],
  fields: personFields,
  parse: (rows) => {
    const { records, warnings } = parsePersons(rows);
    return { records, warnings };
  },
};

// --- reviewers ---

export const reviewersImport: Spec<ReviewerRecord> = {
  label: "Reviewers",
  instructions: (s) => [
    { text: "In ScholarOne, open the **Admin** tab, go to **Search** and select the **People** tab" },
    {
      text: `Search for everyone who volunteers to review, with the display items **PERSON (ID)**, **PERSON (EMAIL)**, **${s.reviewers.keywordsColumn}**, and the student and reviewer designations`,
      warning:
        "PERSON (ID) is required: it identifies reviewers, also when their email address changes",
    },
    {
      text: `Reviewers are linked to divisions through their ${s.reviewers.keywordsColumn} keywords ("Division" or "Division${s.reviewers.keywordSeparator} keyword")`,
    },
    { text: "Select the format **Comma delimited**, click **Run**, and upload the file here" },
  ],
  fields: (s) => [
    ...personFields(s),
    field("student", "Student designation", ["student"]),
    field("reviewer", "Willing to review", ["reviewer"]),
  ],
  parse(rows, settings) {
    const { records: persons, warnings, rowsByPerson } = parsePersons(rows);
    const records = persons.map((person): ReviewerRecord => {
      const personRows = rowsByPerson.get(person) ?? [];
      // a student if any row says so; not willing only if a row explicitly says no
      const student = personRows.some((r) => r.student && !isNo(r.student));
      const willingToReview = !personRows.some((r) => isNo(r.reviewer));
      return { person, student, willingToReview, divisionKeys: [] };
    });
    const noKeywords = records.filter((r) => r.person.keywords.length === 0).length;
    if (noKeywords)
      warnings.push(
        `${noKeywords} reviewers have no ${settings.reviewers.keywordsColumn}, so they are not linked to a division yet`,
      );
    return { records, warnings };
  },
};
