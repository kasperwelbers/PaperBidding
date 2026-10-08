-- Phase A migration: next-auth -> better-auth, and general invitation (join) links.
-- Idempotent: safe to run more than once.
-- Run with: psql "$NEON_DATABASE_URL" -f migrations/2026-10-better-auth-and-join-links.sql
-- Dropping the next-auth tables only signs everyone out. Admin rights are keyed by email.

BEGIN;

-- remove next-auth tables
DROP TABLE IF EXISTS "verificationToken";
DROP TABLE IF EXISTS "session";
DROP TABLE IF EXISTS "account";
DROP TABLE IF EXISTS "user";

-- better-auth tables
CREATE TABLE IF NOT EXISTS "auth_user" (
  "id" text PRIMARY KEY NOT NULL,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "email_verified" boolean DEFAULT false NOT NULL,
  "image" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "auth_user_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "auth_session" (
  "id" text PRIMARY KEY NOT NULL,
  "expires_at" timestamp NOT NULL,
  "token" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  "ip_address" text,
  "user_agent" text,
  "user_id" text NOT NULL,
  CONSTRAINT "auth_session_token_unique" UNIQUE("token"),
  CONSTRAINT "auth_session_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "auth_session_user_idx" ON "auth_session" ("user_id");

CREATE TABLE IF NOT EXISTS "auth_account" (
  "id" text PRIMARY KEY NOT NULL,
  "account_id" text NOT NULL,
  "provider_id" text NOT NULL,
  "user_id" text NOT NULL,
  "access_token" text,
  "refresh_token" text,
  "id_token" text,
  "access_token_expires_at" timestamp,
  "refresh_token_expires_at" timestamp,
  "scope" text,
  "password" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "auth_account_user_id_auth_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "auth_user"("id") ON DELETE cascade
);
CREATE INDEX IF NOT EXISTS "auth_account_user_idx" ON "auth_account" ("user_id");

CREATE TABLE IF NOT EXISTS "auth_verification" (
  "id" text PRIMARY KEY NOT NULL,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS "auth_verification_identifier_idx" ON "auth_verification" ("identifier");

-- general invitation links
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "join_token" varchar(64) DEFAULT replace(gen_random_uuid()::text, '-', '') NOT NULL;
ALTER TABLE "projects" ADD COLUMN IF NOT EXISTS "registration_info_url" text DEFAULT '' NOT NULL;
ALTER TABLE "reviewers" ADD COLUMN IF NOT EXISTS "self_registered" boolean DEFAULT false NOT NULL;

COMMIT;
