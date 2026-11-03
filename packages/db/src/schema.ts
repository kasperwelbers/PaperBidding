// Data model, see docs/conference-planner/plan.md (section 5).
// conference -> editions -> divisions. Users, divisions, persons and keywords
// belong to the conference; submissions, reviewers, bids and assignments to
// an edition.

import { sql } from "drizzle-orm";
import {
  defaultConflictRules,
  type Assigned,
  type ConflictRules,
  type MatchingSettings,
} from "@cp/shared";
import {
  blob,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

const id = () => integer("id").primaryKey({ autoIncrement: true });

// AUTH (better-auth: users sign in with an email code)

const authTimestamp = (name: string) =>
  integer(name, { mode: "timestamp_ms" })
    .notNull()
    .default(sql`(unixepoch('subsec') * 1000)`);

export const authUser = sqliteTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  image: text("image"),
  createdAt: authTimestamp("created_at"),
  updatedAt: authTimestamp("updated_at"),
});

export const authSession = sqliteTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    token: text("token").notNull().unique(),
    createdAt: authTimestamp("created_at"),
    updatedAt: authTimestamp("updated_at"),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
  },
  (t) => [index("auth_session_user_idx").on(t.userId)],
);

export const authAccount = sqliteTable(
  "auth_account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp_ms" }),
    refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp_ms" }),
    scope: text("scope"),
    password: text("password"),
    createdAt: authTimestamp("created_at"),
    updatedAt: authTimestamp("updated_at"),
  },
  (t) => [index("auth_account_user_idx").on(t.userId)],
);

export const authVerification = sqliteTable(
  "auth_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
    createdAt: authTimestamp("created_at"),
    updatedAt: authTimestamp("updated_at"),
  },
  (t) => [index("auth_verification_identifier_idx").on(t.identifier)],
);

// USERS

/** Can create conferences. Managed by the superadmin (env variable) */
export const admins = sqliteTable("admins", {
  email: text("email").primaryKey(),
  createdAt: createdAt(),
});

export const conferences = sqliteTable("conferences", {
  id: id(),
  name: text("name").notNull(),
  /** platform adapter id, e.g. "scholarone" */
  platform: text("platform").notNull(),
  /** preset the settings were copied from, e.g. "ica" */
  preset: text("preset"),
  /** platform settings (from the preset, editable) */
  settings: text("settings", { mode: "json" })
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),
  /** who may review whom (see conflictReason in @cp/shared) */
  conflictRules: text("conflict_rules", { mode: "json" })
    .$type<ConflictRules>()
    .notNull()
    .default(defaultConflictRules),
  createdBy: text("created_by").notNull(),
  createdAt: createdAt(),
});

export const conferenceUsers = sqliteTable(
  "conference_users",
  {
    id: id(),
    conferenceId: integer("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role", { enum: ["admin", "planner"] }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.conferenceId, t.email), index("conference_users_email_idx").on(t.email)],
);

export const divisions = sqliteTable(
  "divisions",
  {
    id: id(),
    conferenceId: integer("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** platform value that identifies the division, e.g. the CURRENT CATEGORY */
    platformKey: text("platform_key"),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.conferenceId, t.name)],
);

export const plannerDivisions = sqliteTable(
  "planner_divisions",
  {
    conferenceUserId: integer("conference_user_id")
      .notNull()
      .references(() => conferenceUsers.id, { onDelete: "cascade" }),
    divisionId: integer("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.conferenceUserId, t.divisionId] })],
);

// EDITIONS

export const editions = sqliteTable(
  "editions",
  {
    id: id(),
    conferenceId: integer("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    /** edition specific platform settings, e.g. the site URL for that year */
    settings: text("settings", { mode: "json" })
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.conferenceId, t.name)],
);

// PEOPLE (conference level, so a person is recognized across editions)

export const persons = sqliteTable(
  "persons",
  {
    id: id(),
    conferenceId: integer("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),
    name: text("name"),
    /** best guess of the current institution (latest import wins; no history) */
    institution: text("institution"),
    /** the institution as written in the latest import, for resolving again */
    institutionRaw: text("institution_raw"),
    createdAt: createdAt(),
  },
  (t) => [index("persons_conference_idx").on(t.conferenceId)],
);

/** Platform person IDs and emails. Each value points to one person in a
 *  conference. A person can have several (emails change; person IDs might
 *  differ between platform sites) */
export const personIdentifiers = sqliteTable(
  "person_identifiers",
  {
    id: id(),
    conferenceId: integer("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["platform_id", "email"] }).notNull(),
    /** emails are stored trimmed and lowercased */
    value: text("value").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.conferenceId, t.kind, t.value),
    index("person_identifiers_person_idx").on(t.personId),
  ],
);

/** In which editions a person appears (as author, reviewer, or in a persons
 *  export). No names or institutions: we don't keep a history of those */
export const editionPersons = sqliteTable(
  "edition_persons",
  {
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.editionId, t.personId] })],
);

// INSTITUTIONS
// The list of universities is bundled data (@cp/institutions). Aliases are
// per conference: corrections for how institutions are written in its data

export const institutionAliases = sqliteTable(
  "institution_aliases",
  {
    conferenceId: integer("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),
    /** normalized (see normalizeInstitution in @cp/institutions) */
    raw: text("raw").notNull(),
    institution: text("institution").notNull(),
  },
  (t) => [primaryKey({ columns: [t.conferenceId, t.raw] })],
);

// KEYWORDS

/** Expertise keywords as in the platform, e.g. "Computational Methods" or
 *  "Computational Methods: content analysis", assigned to a division */
export const keywords = sqliteTable(
  "keywords",
  {
    id: id(),
    conferenceId: integer("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),
    text: text("text").notNull(),
    divisionId: integer("division_id").references(() => divisions.id, {
      onDelete: "set null",
    }),
    /** manual assignments are kept on later imports */
    assignedBy: text("assigned_by", { enum: ["auto", "manual"] }),
  },
  (t) => [unique().on(t.conferenceId, t.text)],
);

// SUBMISSIONS

export const submissions = sqliteTable(
  "submissions",
  {
    id: id(),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    /** e.g. the ScholarOne Control ID */
    externalId: text("external_id").notNull(),
    title: text("title").notNull(),
    abstract: text("abstract").notNull(),
    divisionId: integer("division_id").references(() => divisions.id, {
      onDelete: "set null",
    }),
    status: text("status"),
    /** float32 values, see embeddingToBlob in @cp/shared */
    embedding: blob("embedding", { mode: "buffer" }),
    /** the model that made the embedding; only same-model embeddings are compared */
    embeddingModel: text("embedding_model"),
    createdAt: createdAt(),
  },
  (t) => [
    unique().on(t.editionId, t.externalId),
    index("submissions_division_idx").on(t.editionId, t.divisionId),
  ],
);

export const submissionAuthors = sqliteTable(
  "submission_authors",
  {
    submissionId: integer("submission_id")
      .notNull()
      .references(() => submissions.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    /** 0 = first author */
    position: integer("position").notNull(),
    /** best guess of the institution on this submission */
    institution: text("institution"),
    /** as written in the export */
    institutionRaw: text("institution_raw"),
  },
  (t) => [
    primaryKey({ columns: [t.submissionId, t.position] }),
    index("submission_authors_person_idx").on(t.personId),
  ],
);

// REVIEWERS

export const reviewers = sqliteTable(
  "reviewers",
  {
    id: id(),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    student: integer("student", { mode: "boolean" }).notNull().default(false),
    canReview: integer("can_review", { mode: "boolean" }).notNull().default(true),
    source: text("source", { enum: ["import", "planner", "join_link"] }).notNull(),
    /** for the secret bidding link */
    secret: text("secret").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.editionId, t.personId)],
);

export const reviewerKeywords = sqliteTable(
  "reviewer_keywords",
  {
    reviewerId: integer("reviewer_id")
      .notNull()
      .references(() => reviewers.id, { onDelete: "cascade" }),
    keywordId: integer("keyword_id")
      .notNull()
      .references(() => keywords.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.reviewerId, t.keywordId] })],
);

/** A reviewer can be linked to several divisions. "keyword" links are derived
 *  from the reviewer's keywords */
export const reviewerDivisions = sqliteTable(
  "reviewer_divisions",
  {
    reviewerId: integer("reviewer_id")
      .notNull()
      .references(() => reviewers.id, { onDelete: "cascade" }),
    divisionId: integer("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
    source: text("source", { enum: ["keyword", "planner", "join_link"] }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.reviewerId, t.divisionId, t.source] }),
    index("reviewer_divisions_division_idx").on(t.divisionId),
  ],
);

/** A planner took a reviewer out of their division's pool. Needed because
 *  keyword links come from the central import and are kept */
export const divisionReviewerExclusions = sqliteTable(
  "division_reviewer_exclusions",
  {
    reviewerId: integer("reviewer_id")
      .notNull()
      .references(() => reviewers.id, { onDelete: "cascade" }),
    divisionId: integer("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.reviewerId, t.divisionId] })],
);

// PER DIVISION, PER EDITION

export type { MatchingSettings };

export interface ReferenceSources {
  /** other divisions in the same edition */
  divisionIds: number[];
  /** other editions (all divisions) */
  editionIds: number[];
}

export const divisionEditions = sqliteTable(
  "division_editions",
  {
    id: id(),
    divisionId: integer("division_id")
      .notNull()
      .references(() => divisions.id, { onDelete: "cascade" }),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    /** null = no bidding (matching on similarity only) */
    biddingDeadline: integer("bidding_deadline", { mode: "timestamp_ms" }),
    matchingSettings: text("matching_settings", { mode: "json" }).$type<MatchingSettings>(),
    referenceSources: text("reference_sources", { mode: "json" })
      .$type<ReferenceSources>()
      .notNull()
      .default({ divisionIds: [], editionIds: [] }),
    /** for the general join link */
    joinToken: text("join_token").notNull(),
    createdAt: createdAt(),
  },
  (t) => [unique().on(t.divisionId, t.editionId)],
);

export const bids = sqliteTable(
  "bids",
  {
    divisionEditionId: integer("division_edition_id")
      .notNull()
      .references(() => divisionEditions.id, { onDelete: "cascade" }),
    reviewerId: integer("reviewer_id")
      .notNull()
      .references(() => reviewers.id, { onDelete: "cascade" }),
    /** ordered, most preferred first */
    submissionIds: text("submission_ids", { mode: "json" }).$type<number[]>().notNull(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.divisionEditionId, t.reviewerId] })],
);

export const invitations = sqliteTable(
  "invitations",
  {
    divisionEditionId: integer("division_edition_id")
      .notNull()
      .references(() => divisionEditions.id, { onDelete: "cascade" }),
    reviewerId: integer("reviewer_id")
      .notNull()
      .references(() => reviewers.id, { onDelete: "cascade" }),
    sentAt: integer("sent_at", { mode: "timestamp_ms" }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.divisionEditionId, t.reviewerId] })],
);

export const assignments = sqliteTable("assignments", {
  divisionEditionId: integer("division_edition_id")
    .primaryKey()
    .references(() => divisionEditions.id, { onDelete: "cascade" }),
  settings: text("settings", { mode: "json" }).$type<MatchingSettings>().notNull(),
  /** per submission: the assigned reviewers, and how they were assigned */
  result: text("result", { mode: "json" }).$type<Record<number, Assigned[]>>().notNull(),
  /** per submission: backup reviewer ids, best first (for replacements) */
  backups: text("backups", { mode: "json" }).$type<Record<number, number[]>>().notNull(),
  computedAt: integer("computed_at", { mode: "timestamp_ms" }).notNull(),
  /** set when exported to the platform; changes after that are replacements */
  exportedAt: integer("exported_at", { mode: "timestamp_ms" }),
});

// IMPORTS

export type ImportStatus =
  | "uploaded"
  | "queued"
  | "parsing"
  | "writing"
  /** submissions: computing embeddings */
  | "embedding"
  | "done"
  | "failed";

/** An uploaded file and its processing. The raw file and the parsed record
 *  chunks are in R2, under `fileKey`'s folder */
export const importJobs = sqliteTable(
  "import_jobs",
  {
    id: id(),
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    kind: text("kind", { enum: ["submissions", "persons", "reviewers"] }).notNull(),
    /** a planner's reviewers import: the reviewers are linked to this division */
    divisionId: integer("division_id").references(() => divisions.id, { onDelete: "set null" }),
    status: text("status").$type<ImportStatus>().notNull(),
    filename: text("filename").notNull(),
    fileKey: text("file_key").notNull(),
    size: integer("size").notNull(),
    /** field -> CSV header */
    mapping: text("mapping", { mode: "json" }).$type<Record<string, string>>(),
    totalChunks: integer("total_chunks"),
    doneChunks: integer("done_chunks").notNull().default(0),
    /** e.g. { records: 6000, created: 120, updated: 5880 } */
    counts: text("counts", { mode: "json" }).$type<Record<string, number>>().notNull().default({}),
    warnings: text("warnings", { mode: "json" }).$type<string[]>().notNull().default([]),
    error: text("error"),
    createdBy: text("created_by").notNull(),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" }),
  },
  (t) => [index("import_jobs_edition_idx").on(t.editionId)],
);

/** An import tried to give an identifier (email or person ID) that already
 *  belongs to another person. Not applied; a conference admin decides */
export const importConflicts = sqliteTable(
  "import_conflicts",
  {
    id: id(),
    conferenceId: integer("conference_id")
      .notNull()
      .references(() => conferences.id, { onDelete: "cascade" }),
    importJobId: integer("import_job_id").references(() => importJobs.id, {
      onDelete: "set null",
    }),
    kind: text("kind", { enum: ["platform_id", "email"] }).notNull(),
    value: text("value").notNull(),
    /** the person the identifier belongs to */
    existingPersonId: integer("existing_person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    /** the person the import wanted to give it to */
    incomingPersonId: integer("incoming_person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
    resolvedAt: integer("resolved_at", { mode: "timestamp_ms" }),
  },
  (t) => [
    index("import_conflicts_conference_idx").on(t.conferenceId),
    // re-running an import does not record the same conflict twice
    unique().on(t.conferenceId, t.kind, t.value, t.existingPersonId, t.incomingPersonId),
  ],
);
