# Plans for the next version (after the 2026 bidding round)

Notes collected during the ICA 2027 bidding round (fall 2026). Nothing here is
implemented yet unless stated.

## 1. Organize centrally for the whole ICA conference

Now every division planner creates a project and uploads submissions and
reviewers themselves. With many submissions this year, those uploads crashed.

- Upload and process all ICA submissions (and reviewers) once, centrally.
  Planners select their division, and only upload things that are missing.
- Store each submission once (one shared store), instead of a copy per
  project.
- Interim solution this year: `REFERENCE_POOL_PROJECT_ID`. The reviewer queries
  also read a reviewer's submissions from that project, as reference
  submissions (similarity and co-author conflicts, not authorship). Replace
  this with the shared store.
- Find out what crashed during uploads (browser memory during feature
  extraction, or the server/DB). Process and upload in chunks, and allow adding
  to existing data (now the upload box is replaced by the data list once a
  project has submissions).

## 2. Rewrite database migrations

- `npm run migrate` (drizzle-kit generate + migrator on `drizzle-output/`) is
  stale and unsafe: `drizzle-output/` is not in the repo, so it would generate
  a create-everything migration against Neon. Don't use it.
- Migrations are now hand-written idempotent SQL in `migrations/`, applied by
  hand with psql. Pick one tool (e.g., drizzle-kit migrations committed to the
  repo, with the migrations journal in sync with Neon) and remove the other.
- Make deploying (code + migration) one documented step, so a feature cannot
  go live before its table exists (this happened with `ica_persons`).

## 3. ICA Person ID matching: who wins when values differ

Now `ica_persons` is one global email -> Person ID table, and every upload
(Step 2 reviewer CSV, Step 6 matching list) overwrites existing values (last
write wins). Good for fixing mistakes, but one planner with a bad file can
break the matches for every division.

Safer design:
- Store what each project uploads separately (per-project email -> Person ID).
- For a project, use its own uploaded values first, and the central table only
  as a fallback.
- The central table only gets filled for emails it does not have yet. Conflicts
  (same email, different ID) are flagged for the superadmin instead of
  silently overwritten.
- Show the source of each match in Step 6 ("from your upload" / "central").
- Emails change. If a reviewer changes their email in ScholarOne after the
  reviewer list was exported, the old email can no longer be matched to a
  Person ID. That's why PERSON (ID) is now required in the Step 2 upload (since
  Nov 2026). Next version: identify reviewers by Person ID rather than email
  (store it on the reviewer row), and treat email only as contact info.
- (Done, Nov 2026: Step 6 lets planners enter a Person ID by hand for a single
  unmatched reviewer, e.g., found by name in ScholarOne.)

## 4. Reviewers without a Person ID (not in ScholarOne)

This happens when someone bids (e.g., via the general invitation link) but
never made an ICA account, or uses a different email address there. Now
Step 6 tells planners to ask these reviewers to register (with a prepared
email), and then upload the matching list again.

Better:
- **Prevent it:** when someone joins via the invitation link, check the email
  against the central Person ID table, and if it's missing, tell them right
  away to create an ICA account with that email address.
- **Warn earlier:** show the number of reviewers without a Person ID in Step 2
  and before computing assignments in Step 5, so planners can exclude them
  or ask them to register before the assignments are made.
- **Replace without recomputing:** `makeAssignments` already computes
  `backupReviewers` per submission, but does not store them. Save them with the
  assignments, and offer "recommend replacement" for an unmatched (or
  dropped) reviewer: swap in the best backup for each of their submissions,
  without changing anyone else's assignments.
- Recomputing all assignments after excluding someone changes other reviewers'
  assignments too, which is a problem once anything is uploaded to ICA. Either
  lock assignments after export, or make recomputing keep existing assignments
  where possible.

## 5. Small open items

- Step 6: fill in the exact ScholarOne menu path for the bulk reviewer
  assignment upload (placeholder on the page).
- The ICA CM guide calls the reviewer ID column "USER ID", while the app uses
  PERSON (ID). Check which one ScholarOne uses and align the instructions.
