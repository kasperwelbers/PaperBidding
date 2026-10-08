import { config } from "dotenv";
import { type InferSelectModel, type InferInsertModel, sql } from "drizzle-orm";
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

import { neon } from "@neondatabase/serverless";
import postgres from "postgres";
import { drizzle as drizzleNeon } from "drizzle-orm/neon-http";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { AssignmentSettings, ByReviewer, BySubmission } from "@/types";

config({ path: ".env.local" });

// AUTH TABLES (better-auth)

export const authUser = pgTable("auth_user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const authSession = pgTable(
  "auth_session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => authUser.id, { onDelete: "cascade" }),
  },
  (table) => [index("auth_session_user_idx").on(table.userId)],
);

export const authAccount = pgTable(
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
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("auth_account_user_idx").on(table.userId)],
);

export const authVerification = pgTable(
  "auth_verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("auth_verification_identifier_idx").on(table.identifier)],
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
  joinToken: varchar("join_token", { length: 64 })
    .notNull()
    .default(sql`replace(gen_random_uuid()::text, '-', '')`),
  registrationInfoUrl: text("registration_info_url").notNull().default(""),
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
    student: boolean("student").notNull().default(false),
    canReview: boolean("can_review").notNull().default(true),
    importedFrom: varchar("imported_from", {
      enum: ["volunteer", "submission"],
    }),
    secret: varchar("token", { length: 64 }).notNull(),
    selfRegistered: boolean("self_registered").notNull().default(false),
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
