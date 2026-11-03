// Data model, see docs/conference-planner/plan.md (section 5).
// conference -> editions -> divisions. Users, divisions, persons and keywords
// belong to the conference; submissions, reviewers, bids and assignments to
// an edition.

import { sql } from "drizzle-orm";
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
    institution: text("institution"),
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

/** A person as seen in an edition (as author, reviewer, or in a persons export) */
export const editionPersons = sqliteTable(
  "edition_persons",
  {
    editionId: integer("edition_id")
      .notNull()
      .references(() => editions.id, { onDelete: "cascade" }),
    personId: integer("person_id")
      .notNull()
      .references(() => persons.id, { onDelete: "cascade" }),
    name: text("name"),
    institution: text("institution"),
    source: text("source").notNull(),
  },
  (t) => [primaryKey({ columns: [t.editionId, t.personId] })],
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
    institution: text("institution"),
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
    source: text("source", { enum: ["import", "join_link"] }).notNull(),
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

// PER DIVISION, PER EDITION

export interface MatchingSettings {
  reviewersPerSubmission: number;
  maxStudentReviewers: number;
  /** added to the rank of similarity-based (not bid) matches */
  noBidPenalty: number;
  includeWho: "all" | "authors" | "authors or bidders";
}

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
  /** per submission: the assigned reviewer ids, in order */
  result: text("result", { mode: "json" }).$type<Record<number, number[]>>().notNull(),
  /** per submission: backup reviewer ids, best first (for replacements) */
  backups: text("backups", { mode: "json" }).$type<Record<number, number[]>>().notNull(),
  computedAt: integer("computed_at", { mode: "timestamp_ms" }).notNull(),
  /** set when exported to the platform; changes after that are replacements */
  exportedAt: integer("exported_at", { mode: "timestamp_ms" }),
});
