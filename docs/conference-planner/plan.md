# Conference planner: plan for the new version

Status: draft, November 2026 (written during the ICA 2027 bidding round).
Branch: `conference-planner`, in this repository. Once the new version works, it
replaces the current app, and the repository will be renamed. Until then, the
current app (Next.js + Neon) stays on `main` for bug fixes.

## 1. What changes, and why

The current app is organized per division: every planner creates a project
and uploads the submissions and reviewers for their division. For ICA 2027
this broke down. Uploads crashed with the number of submissions, the same data
was uploaded many times, and reviewers had to be matched to ICA Person IDs per
division. See `docs/next-version.md` for the lessons from this round.

The new version:

1. **Is organized per conference and edition.** A conference admin imports the
   data of an edition once, for everyone. Division planners only add what is
   missing, and choose which reference submissions to use.
2. **Separates the platform from the app.** Everything specific to a platform
   (ScholarOne) lives in an **adapter**. Everything specific to how a
   conference uses that platform (ICA's columns, saved searches, keyword
   conventions) lives in a **preset** on top of the adapter.
3. **Gets a broader name and scope.** Matching reviewers to submissions is the
   first feature, but more may follow. Working name: **conference-planner**.
4. **Makes paper bidding optional.** Matching works on automatic similarity
   alone. Bidding is an optional step that improves the matching. The UI and
   texts should say this clearly.
5. **Moves to a new stack:** a monorepo with a Vite SPA and a Hono API, hosted
   on Cloudflare, with D1 (SQLite) as the database and Workers AI for the
   embeddings.

The first goal is to **port reviewer matching**: import, (optional) bidding,
assignments, and export.

## 2. Concepts

| Concept | Meaning | ICA example |
|---|---|---|
| Admin | Can create conferences. Added by the superadmin | |
| Conference | A recurring conference, with its own users, divisions, platform, and preset | ICA |
| Conference user | A user of one conference, with the role `admin` or `planner` | |
| Division | A unit that does its own reviewing. Planners are linked to divisions | Computational Methods |
| Edition | One round of the conference: a name plus a created timestamp | ICA 2027 |
| Person | Someone known to the conference, across editions, with one or more identifiers (platform person ID, emails) | ScholarOne PERSON (ID) |
| Keyword | An expertise keyword from the platform, assigned to a division | "Computational Methods: content analysis" |
| Submission | A paper or abstract in an edition, with authors (persons) and a division | Control ID |
| Reviewer | A person in the reviewer pool of an edition, linked to one or more divisions (mostly through their keywords) | |
| Reference submissions | Submissions used only for similarity (other divisions and/or other editions), chosen per division | |

- **Hierarchy:** conference → editions → divisions. Divisions and users belong
  to the conference and carry over between editions. Data (submissions,
  reviewers, bids, assignments) belongs to an edition.
- **Identity:** persons are identified by **platform person ID, not by email.**
  Emails are contact details and can change, which was the root of the Person
  ID problems this year. A person belongs to the conference, so the same
  person is recognized in every edition, and can have several emails.

## 3. Users and access

- **Superadmin** (env variable): manages the list of admins.
- **Admins:** can create conferences, and become that conference's first
  conference admin.
- **Conference users:** every conference has its own list of users.
  - `admin`: manages the conference, editions, divisions, users, and the
    central imports.
  - `planner`: linked to one or more divisions. Works on those divisions in
    each edition.
- **Reviewers** don't need an account. They use secret bidding links (HMAC
  tokens) and the general join link, like now.
- **Data access: open, like ScholarOne.** Everyone with a role in a conference
  can **see** everything in that conference (all divisions, submissions,
  reviewers and their division links). Planners can only **edit** their own
  divisions, and conference admins can edit everything.
  - All access checks go through one permission helper in the API (`canView`,
    `canEdit`), so stricter rules can be added later in one place.
  - Similarity and rankings are still computed on the server. Not for privacy,
    but so the browser doesn't download every embedding.

## 4. Stack and repository layout

Monorepo with pnpm workspaces:

```
apps/
  web/                    Vite + React + TypeScript SPA (Tailwind, shadcn/ui)
  api/                    Hono on Cloudflare Workers (wrangler)
packages/
  shared/                 zod schemas, types, similarity and matching algorithm
  db/                     drizzle schema for D1 (sqlite), committed migrations
  adapter-scholarone/     ScholarOne adapter, plus presets (ICA)
docs/
```

- **Hosting:** Cloudflare. The SPA runs on Workers static assets, the API on
  Workers, and the database on D1. Raw uploaded files go to R2. Long imports
  (parsing, embeddings) run through Queues.
- **Embeddings:** Workers AI (e.g. `@cf/baai/bge-small-en-v1.5`, 384
  dimensions), computed in the queue on the server. Nothing heavy runs in the
  browser.
- **Plan:** we recommend the Workers Paid plan ($5/month) to anyone hosting
  this. It includes enough compute and storage, and Workers AI (10,000 free
  neurons per day, then $0.011 per 1,000 neurons). The free plan might work,
  but at your own risk. Put this in the README.
- **Auth:** better-auth with the drizzle sqlite adapter, and email OTP sign-in.
- **Email:** behind a small `EmailSender` interface. The first implementation
  is **Scaleway Transactional Email** (cheap, pay per use).
  - **Transport:** use Scaleway's HTTP API from the Worker. SMTP on port 587
    over Cloudflare TCP sockets is the alternative. Port 25 is blocked on
    Workers.
  - **README:** explain that email needs a proper setup (verified domain, SPF,
    DKIM, DMARC), or sign-in codes and invitations end up in spam.
  - **Development:** print sign-in codes to the console, like now.
- **Migrations:** drizzle-kit migrations are committed to `packages/db`, and
  applied with `wrangler d1 migrations apply` (local, then remote). There is one
  tool and one documented deploy order: migrations, then code.
- **Local development:** `wrangler dev` with a local D1 (miniflare). There is
  no shared database in development.

D1 and Workers limits to design for:

- At most **100 bound parameters per query**, so batch inserts need chunking.
  Use `db.batch` for atomic groups.
- About 10 GB per database. That's fine if each submission is stored once.
- Worker CPU time per request is limited. Heavy work (embeddings, big imports)
  goes through Queues in chunks.

## 5. Data model (first version)

- **Users:** `admins` (email); `conferences` (name, `platform`, `preset`,
  settings JSON); `conference_users` (conference, email, role `admin` /
  `planner`); `divisions` (conference, name, platform key, e.g. the CURRENT
  CATEGORY value); `planner_divisions` (conference user, division).
- **Editions:** `editions` (conference, name, created, platform settings, e.g.
  the ScholarOne site URL for that year).
- **People** (conference level, so a person is recognized across editions):
  - `persons`: conference, local ID, name, institution.
  - `person_identifiers`: person, kind (`platform_id` / `email`), value. Unique
    per conference and kind, so an email or a person ID points to exactly one
    person.
    - **Why a separate table:** it covers several emails per person and email
      changes. It also keeps working if the person IDs turn out *not* to be
      shared between the yearly ScholarOne sites: a person can then get
      another `platform_id` row.
    - **Conflicts:** an import that would move an identifier to another person
      records a conflict for the conference admin instead of overwriting it
      (section 7).
  - `edition_persons`: edition, person, and the source. One row for every
    edition in which a person appears (as author, reviewer or in the persons
    export). No names or institutions per edition: `persons` only keeps a best
    guess of the current institution (section 9).
- **Submissions:**
  - `submissions`: edition, `external_id` (Control ID), title, abstract,
    division (from CURRENT CATEGORY), status, embedding (blob).
  - `submission_authors`: submission, person, position, institution.
- **Keywords:**
  - `keywords`: conference, text (as in the platform, e.g. "Computational
    Methods" or "Computational Methods: content analysis"), division
    (nullable), and how it was assigned (`auto` / `manual`). See section 8.
- **Reviewers:**
  - `reviewers`: edition, person, student, willing to review, source
    (`import` / `join_link`), bidding secret.
  - `reviewer_keywords`: reviewer, keyword.
  - `reviewer_divisions`: reviewer, division, source (`keyword` / `planner` /
    `join_link`). The `keyword` links are derived from the reviewer's keywords.
    A reviewer can be linked to several divisions.
- **Per division, per edition:** settings (bidding deadline, matching settings,
  and the selected reference sources: which other divisions and which other
  editions); `bids` (division, edition, reviewer, ordered submission IDs);
  `invitations` (sent at); `assignments` (settings, result, **backup reviewers
  per submission**, computed at, exported at / locked).

Reference submissions need no copying. For a reviewer in a division, the
reference set is their own submissions in the selected sources. That replaces
`REFERENCE_POOL_PROJECT_ID`.

## 6. Platform adapter and presets

Two layers:

- **Adapter** (platform): file formats, column detection, parsing into
  normalized records, export formats, and generic instructions. Examples:
  `scholarone` now, a ScholarOne API adapter that keeps assignments in sync
  later, maybe others.
- **Preset** (how one conference uses that platform): column choices, saved
  search names, how divisions are recognized, and the site URL pattern.
  - **Example:** the `ica` preset: the division comes from **CURRENT
    CATEGORY**, reviewer divisions come from **PERSON (AREA OF EXPERTISE)**
    keywords that contain the division name, the saved searches are "Paper
    Bidding (select division yourself)" and "[Division] Reviewers", and the
    site is `ica<year>.abstractcentral.com`.
  - **Storage:** a preset is a default. Its values are copied into the
    conference settings and can be edited there.

```ts
interface PlatformAdapter {
  id: string;                          // "scholarone"
  name: string;                        // "ScholarOne Abstracts"
  presets: Preset[];                   // e.g. ICA
  links(edition: Edition, settings: ConferenceSettings): {
    site: string;
    registration: string;
  };

  imports: {
    submissions: ImportSpec<SubmissionRecord>;
    persons: ImportSpec<PersonRecord>;       // email <-> person ID (+ expertise)
    reviewers: ImportSpec<ReviewerRecord>;
  };
  exports: {
    assignments: ExportSpec;           // e.g. "Person ID,Control ID", UTF-8 BOM
  };
}

interface ImportSpec<T> {
  instructions(settings: ConferenceSettings): InstructionStep[]; // rendered by the UI
  fields: FieldSpec[];                 // column, header aliases, required/optional
  parse(
    rows: Record<string, string>[],
    settings: ConferenceSettings,
  ): { records: T[]; warnings: string[] };
}
```

- **Normalized records:**
  - `SubmissionRecord`: external ID, title, abstract, division key, status, and
    authors (email, institution, position, person ID if known).
  - `PersonRecord`: person ID, emails, name, institution, and expertise
    keywords.
  - `ReviewerRecord`: person, student, willing to review, and division keys.
- **Instructions are data.** The ScholarOne steps (now Steps 1, 2 and 6 in the
  app) move into the adapter and preset. The UI renders them.
- **Validation lives in the adapter.** Required columns (e.g. PERSON (ID)),
  "PRESENTER (EMAIL) is not the authors column", and similar checks all go here.

## 7. Import and processing pipeline

This is where this year's crashes came from, so it gets the most care.

1. **Upload:** the browser uploads the raw CSV to R2 (streamed through the
   API). There's no processing in the browser.
2. **Parse:** a Queue consumer parses the file with the adapter and preset, in
   chunks, and writes normalized records in batches (100-parameter limit).
3. **Embed:** a second queue step computes the embeddings with Workers AI, in
   chunks, and stores them as blobs.
4. **Progress:** an import job row (status, counts, warnings, errors) is shown
   in the UI. Jobs can be re-run, and imports are idempotent upserts by
   external ID or person ID.
5. **Conflicts:** if an import gives an email that already belongs to another
   person ID, it doesn't overwrite. It records a conflict for the conference
   admin. A planner's import never changes another division's data.

## 8. Keywords, and reviewers in several divisions

At ICA, a reviewer gets reviews from every division whose expertise keyword
they picked. That is a poor system, but it's what ScholarOne uses, so we
support it as the starting point for the reviewer pools.

**Keywords:**

- **Format:** ScholarOne's PERSON (AREA OF EXPERTISE) values look like
  "Computational Methods" (the division alone) or "Computational Methods:
  content analysis" (division: keyword).
- **Keywords table:** every distinct value becomes a row in `keywords`. That's
  useful beyond division links, e.g. for showing a reviewer's expertise.
- **Auto-assign:** on import, the part before the first ":" (or the whole
  value) is matched to the division names, case-insensitive and
  whitespace-normalized. The matching rule is part of the preset.
- **Orphan keywords:** keywords that don't match a division are shown to the
  conference admin as a warning, so they can assign them by hand. A manual
  assignment is kept on later imports.
- **Keeping links current:** changing a keyword's division updates the
  `keyword` links of the reviewers who have that keyword.

**Division load:**

- **Show the load:** for each reviewer, show how many divisions they're linked
  to, in the reviewer list and in the matching.
- **Use it in the matching:** e.g. fewer assignments for reviewers who are in
  many divisions, or a lower priority. It's a setting per division.
- **What we can't see:** not every planner uses this system, so we can't know
  all of a reviewer's assignments. Within our system, we can show assignments
  from other divisions in the same edition. A ScholarOne API adapter could sync
  all assignments later.

## 9. Institutions, and who may review whom

**Institutions** (implemented):

- **The university list** is the Hipo university-domains-list (MIT). A compact
  copy is in `packages/institutions/data`, pinned to a commit, and bundled into
  the Worker. It is refreshed only by hand (`pnpm --filter @cp/institutions
  update`).
- **Resolving** happens on the server during imports:
  1. a per-conference alias
  2. the email domain, including parent domains, never webmail
  3. a name match, preferring the most specific university
  4. otherwise, the text as written
- **What is stored:** for authors, the institution on that submission (best
  guess plus raw text). For persons, only a best guess of the *current*
  institution, overwritten by the latest import. There is no history of
  affiliations, for privacy.
- **Unresolved names** are listed for the conference admin, who maps them to a
  university or keeps them as their own institution (an alias).

**Who may review whom** (implemented as `conflictReason` in `@cp/shared`):

- **One function** for both the bidding page and the matching, working on
  person IDs and resolved institutions.
- **Always:** reviewers never review their own submissions.
- **Conference settings** (`conflict_rules`), each on/off:
  - co-authors in the current edition
  - co-authors in earlier editions of this conference
  - an author with the reviewer's current institution, per submission
- **Missing data is never a conflict.** That fixes a legacy bug where reviewers
  without an institution were blocked from submissions where an author had
  none.
- **Only data from the conference itself.** No relationships (e.g. advisor and
  student).

## 10. Flow in the new version

**Superadmin:** adds admins.

**Admin / conference admin:**

1. Create the conference, pick the platform and preset (ScholarOne + ICA),
   create the divisions, and add users (conference admins, and planners linked
   to divisions).
2. Create an edition (e.g. "ICA 2027").
3. Import all submissions of the edition. Divisions are filled from CURRENT
   CATEGORY.
4. Import the persons/reviewers export (PERSON (ID), email, AREA OF EXPERTISE).
   Keywords are matched to divisions, and reviewers get linked to divisions
   through their keywords. Assign any orphan keywords.

**Planner** (per division, per edition):

1. Check the division's submissions and reviewer pool, and add anything
   missing (an upload, by hand, or via the join link).
2. Choose the reference submissions: which other divisions, and which other
   editions.
3. *Optional:* paper bidding. Send invitations and follow progress. Without
   bidding, matching uses similarity only.
4. Compute assignments, taking into account how many divisions each reviewer
   is in. Review them, exclude reviewers, and **replace a reviewer** using the
   stored backups, without recomputing everyone.
5. Export to the platform (adapter), with the list of unmatched persons and how
   to fix each one. Exporting locks the assignments, and later changes are
   explicit replacements.

**Backlog:** import earlier years (from the current Neon database or old
ScholarOne exports) as past editions with submissions only. That's not part of
the first version.

## 11. What carries over from the current code

- **Matching:** `makeAssignments.ts`, `computeRelevantSubmissions.ts` and
  cosine similarity move to `packages/shared` and get unit tests. Keep the
  backups that are now thrown away, and add the division-load setting.
- **Institutions:** ported to `packages/institutions` (section 9).
- **CSV handling:** column detection from `csvUpload.tsx`. The defaults move
  into the adapter's field specs and the preset.
- **UI pieces:** Steps, the bidding page, invitations, and Step 6 (matching
  status, unmatched list, entering a Person ID by hand).
- **Lessons:** queries scoped to one edition and division, and no joins on
  Control ID alone.

## 12. Phases

0. **Scaffold** the monorepo (`apps/web`, `apps/api`, `packages/*`), wrangler
   config with local D1, R2 and Queues, drizzle schema and the first
   migration, CI with type check and tests.
1. **Users:** better-auth on D1 with email OTP (Scaleway sender, console in
   development), admins, conferences, conference users, divisions, and
   editions.
2. **Adapter and imports:** the ScholarOne adapter with the ICA preset, R2
   upload, queue parsing, the import job UI, and persons, submissions, and
   reviewers with their division links.
3. **Embeddings** with Workers AI in the queue, and server-side similarity in
   `packages/shared` (done, together with institutions and conflict rules).
   Workers AI only runs on Cloudflare, so local development has three parts:
   - **Demo project:** a "Load demo conference" button (development only)
     creates a synthetic conference (divisions, persons, keywords,
     submissions, reviewers) through the normal import pipeline, embedded with
     the stand-in. It is synthetic, with no real data in the repository.
   - **Stand-in embedder:** without a login, uploads in local development use
     a lexical feature-hashing embedder (word overlap). It is not semantic, but
     similar texts still score as similar, so the whole flow can be tested.
     Production refuses it.
   - **Real embeddings locally:** `pnpm dev:remote-ai` uses real Workers AI,
     for developers who are logged in to Cloudflare.
   - **Embeddings record their model** (an `embedding_model` column), and
     similarity only compares embeddings from the same model. Demo, stand-in
     and real embeddings never mix.
4. **Division setup** (done): submissions and reviewer pool per division
   (keyword links, reviewers added by planners or imported for the division,
   and the join link; planners can take keyword reviewers out of their own
   division only), reference source selection with each reviewer's number of
   own submissions in it, and the join link.
5. **Optional bidding** (done): invitations, the bidding page, and the deadline.
   - **Imported reviewers** get an invitation email with a personal bidding
     link.
   - **People who join via the join link** go straight to bidding from the
     join page, with no invitation needed. The join page tells them to use the
     same email as their platform account, since we can't check that without
     platform API access.
   - **Assignments are made in the platform** (from our export); we send no
     assignment emails.
6. **Matching:** compute (with division load), review, exclude, replace with
   backups, and lock.
7. **Export:** the ScholarOne CSV and the unmatched-persons workflow.
8. **Pilot** on a test conference, then the next ICA round. Rename the
   repository.

Later:

- stricter data access rules, if a conference needs them
- a ScholarOne API adapter (sync assignments)
- importing the backlog of earlier editions
- other platforms

## 13. Open questions

1. Do ScholarOne person IDs stay the same between yearly ICA sites? Probably
   yes. The data model works either way (section 5, `person_identifiers`), but
   we should check it on the first import of two editions.
2. ~~Keyword format~~: decided ("Division" or "Division: keyword", with a
   keywords table, auto-matching, and orphan warnings; section 8).
3. ~~Who can see what~~: decided (open viewing, editing only for your own
   divisions; section 3).
