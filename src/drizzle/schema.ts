import { config } from "dotenv";
import { type InferSelectModel, type InferInsertModel } from "drizzle-orm";
import {
  boolean,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
  unique,
  primaryKey,
  index,
} from "drizzle-orm/pg-core";
import type { AdapterAccount } from "@auth/core/adapters";
import { randomBytes } from "crypto";

import { neon } from "@neondatabase/serverless";
import postgres from "postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { AssignmentSettings, ByReviewer, BySubmission } from "@/types";

config({ path: ".env.local" });

// AUTH TABLES

export const users = pgTable("user", {
  id: text("id").notNull().primaryKey(),
  name: text("name"),
  email: text("email").notNull(),
  emailVerified: timestamp("emailVerified", { mode: "date" }),
  image: text("image"),
});

export const accounts = pgTable(
  "account",
  {
    userId: text("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").$type<AdapterAccount["type"]>().notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("providerAccountId").notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    token_type: text("token_type"),
    scope: text("scope"),
    id_token: text("id_token"),
    session_state: text("session_state"),
  },
  (account) => ({
    compoundKey: primaryKey({
      columns: [account.provider, account.providerAccountId],
    }),
  }),
);

export const sessions = pgTable("session", {
  sessionToken: text("sessionToken").notNull().primaryKey(),
  userId: text("userId")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
  "verificationToken",
  {
    identifier: text("identifier").notNull(),
    token: text("token").notNull(),
    expires: timestamp("expires", { mode: "date" }).notNull(),
  },
  (vt) => ({
    compoundKey: primaryKey({ columns: [vt.identifier, vt.token] }),
  }),
);

// APPLICATION TABLES

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }).notNull(),
  division: varchar("division", { length: 256 }).notNull(),
  deadline: timestamp("deadline").notNull(),
  created: timestamp("created").notNull().defaultNow(),
  creator: varchar("creator", { length: 256 }).notNull(),
  archived: boolean("archived").notNull().default(false),
  secretVersion: integer("secret_version").notNull().default(1),
});

export const admins = pgTable("admins", {
  email: varchar("email", { length: 256 }).primaryKey(),
});

export const projectAdmins = pgTable(
  "project_admins",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 256 }).notNull(),
    isCreator: boolean("is_creator").notNull().default(false),
  },
  (table) => {
    return {
      emailIdx: index("projectadmin_email_idx").on(table.email),
      projectIdx: index("projectadmin_project_idx").on(table.projectId),
    };
  },
);

export const submissions = pgTable(
  "submissions",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    submissionId: varchar("submission_id", { length: 256 }).notNull(),
    title: text("title").notNull(),
    abstract: text("abstract").notNull(),
    features: jsonb("features").$type<number[]>().notNull(),
    authors: jsonb("authors").$type<string[]>().notNull(),
    institutions: jsonb("institutions").$type<string[]>().notNull().default([]),
    isReference: boolean("is_reference").notNull().default(false),
  },
  (table) => {
    return {
      unq: unique().on(table.projectId, table.submissionId),
      projectIds: index("project_id_idx").on(table.projectId),
      submissionIdx: index("submission_idx").on(table.submissionId),
    };
  },
);

export const authors = pgTable(
  "authors",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id"),
    submissionId: varchar("submission_id", { length: 256 }).notNull(),
    position: integer("position").notNull(),
    email: varchar("email", { length: 256 }).notNull(),
    institution: text("institution").notNull().default(""),
  },
  (table) => {
    return {
      submissionReference: foreignKey({
        columns: [table.projectId, table.submissionId],
        foreignColumns: [submissions.projectId, submissions.submissionId],
      }).onDelete("cascade"),
      emailIdx: index("authors_email_idx").on(table.email),
      submissionIdx: index("authors_submission_idx").on(table.submissionId),
    };
  },
);

// TODO: refactor so that reviewers are always uploaded. So drop importedFrom.

export const reviewers = pgTable(
  "reviewers",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 256 }).notNull(),
    institution: text("institution").notNull().default(""),
    importedFrom: varchar("imported_from", {
      enum: ["volunteer", "submission"],
    }),
    secret: varchar("token", { length: 64 }).notNull(),
    invitationSent: timestamp("invitation_sent", { mode: "date" }),
  },
  (table) => {
    return {
      unq: unique().on(table.projectId, table.email, table.importedFrom),
    };
  },
);

export const biddings = pgTable(
  "bids",
  {
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    email: varchar("email", { length: 256 }).notNull(),
    submissionIds: jsonb("biddings").$type<number[]>().notNull(),
    updated: timestamp("updated").notNull().defaultNow(),
  },
  (table) => {
    return {
      pk: primaryKey({ columns: [table.projectId, table.email] }),
    };
  },
);

export const assignments = pgTable(
  "assignment",
  {
    id: serial("id").primaryKey(),
    projectId: integer("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    byReviewer: jsonb("byReviewer").$type<ByReviewer[]>().notNull(),
    bySubmission: jsonb("bySubmission").$type<BySubmission[]>().notNull(),
    settings: jsonb("setting").$type<AssignmentSettings>().notNull().default({
      reviewersPerSubmission: 3,
      autoPenalty: 5,
    }),
    updated: timestamp("updated").notNull().defaultNow(),
  },
  (table) => {
    return {
      unqProject: unique().on(table.projectId),
    };
  },
);

export type Project = InferSelectModel<typeof projects>;
export type NewProject = InferInsertModel<typeof projects>;

export type Submission = InferSelectModel<typeof submissions>;
export type NewSubmission = InferInsertModel<typeof submissions>;

export type Author = InferSelectModel<typeof authors>;
export type NewAuthor = InferInsertModel<typeof authors>;

export type Reviewer = InferSelectModel<typeof reviewers>;
export type NewReviewer = InferInsertModel<typeof reviewers>;

function getDB() {
  if (process.env.NEON_DATABASE_URL) {
    const queryClient = neon(process.env.NEON_DATABASE_URL || "");
    const db = drizzleNeon(queryClient);
    return db;
  } else {
    const queryClient = postgres(process.env.DATABASE_URL || "");
    const db = drizzlePostgres(queryClient);
    return db;
  }
}

declare global {
  var db: ReturnType<typeof getDB>;
}
let db: ReturnType<typeof getDB>;

if (process.env.NODE_ENV === "development") {
  if (!global.db) global.db = getDB();
  db = global.db;
} else {
  db = getDB();
}

export default db;
