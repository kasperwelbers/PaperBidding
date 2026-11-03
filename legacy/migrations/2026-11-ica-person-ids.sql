-- Global mapping of email -> ICA (ScholarOne) Person ID, used to export
-- reviewer assignments in the ICA bulk upload format (Step 6).
-- Idempotent: safe to run more than once.
-- Run with: psql "$NEON_DATABASE_URL" -f migrations/2026-11-ica-person-ids.sql
-- Emails are stored trimmed and lowercased.

BEGIN;

CREATE TABLE IF NOT EXISTS "ica_persons" (
  "email" varchar(256) PRIMARY KEY NOT NULL,
  "person_id" varchar(64) NOT NULL,
  "updated" timestamp DEFAULT now() NOT NULL
);

COMMIT;
