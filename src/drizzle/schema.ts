import { config } from 'dotenv';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
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
  index
} from 'drizzle-orm/pg-core';
import type { AdapterAccount } from '@auth/core/adapters';

import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';

config({ path: '.env.local' });

// AUTH TABLES

export const users = pgTable('user', {
  id: text('id').notNull().primaryKey(),
  name: text('name'),
  email: text('email').notNull(),
  emailVerified: timestamp('emailVerified', { mode: 'date' }),
  image: text('image')
});

export const accounts = pgTable(
  'account',
  {
    userId: text('userId')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccount['type']>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('providerAccountId').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state')
  },
  (account) => ({
    compoundKey: primaryKey(account.provider, account.providerAccountId)
  })
);

export const sessions = pgTable('session', {
  sessionToken: text('sessionToken').notNull().primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull()
});

export const verificationTokens = pgTable(
  'verificationToken',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull()
  },
  (vt) => ({
    compoundKey: primaryKey(vt.identifier, vt.token)
  })
);

// APPLICATION TABLES

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }).notNull().unique(),
  created: timestamp('created').notNull().defaultNow(),
  creator: varchar('creator', { length: 256 }).notNull()
});

export const admins = pgTable('admins', {
  email: varchar('email', { length: 256 }).primaryKey()
});

export const projectAdmins = pgTable(
  'project_admins',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    email: varchar('email', { length: 256 }).notNull()
  },
  (table) => {
    return {
      emailIdx: index('email_idx').on(table.email),
      projectIdx: index('project_idx').on(table.projectId)
    };
  }
);

export const submissions = pgTable(
  'submissions',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    submissionId: varchar('submission_id', { length: 256 }).notNull(),
    title: text('title').notNull(),
    abstract: text('abstract').notNull(),
    features: jsonb('features').notNull(),
    authors: jsonb('authors').notNull(),
    isReference: boolean('is_reference').notNull().default(false)
  },
  (table) => {
    return {
      unq: unique().on(table.projectId, table.submissionId),
      projectIds: index('project_id_idx').on(table.projectId),
      submissionIdx: index('submission_idx').on(table.submissionId)
    };
  }
);

export const authors = pgTable(
  'authors',
  {
    id: serial('id').primaryKey(),
    projectId: integer('project_id'),
    submissionId: varchar('submission_id', { length: 256 }).notNull(),
    email: varchar('email', { length: 256 }).notNull()
  },
  (table) => {
    return {
      submissionReference: foreignKey({
        columns: [table.projectId, table.submissionId],
        foreignColumns: [submissions.projectId, submissions.submissionId]
      }).onDelete('cascade'),
      emailIdx: index('email_idx').on(table.email),
      submissionIdx: index('submission_idx').on(table.submissionId)
    };
  }
);

export const reviewers = pgTable('reviewers', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 256 }).notNull(),
  firstname: varchar('firstname', { length: 256 }).notNull(),
  secret: varchar('token', { length: 32 }).notNull(),
  invitationSent: timestamp('invitation_sent', { mode: 'date' }),
  biddings: jsonb('biddings').notNull(),
  importedFrom: varchar('imported_from', { length: 256 })
});

export const biddings = pgTable('bids', {
  id: serial('id').primaryKey(),
  reviewerId: integer('reviewer_id')
    .notNull()
    .references(() => reviewers.id, { onDelete: 'cascade' }),
  submissionId: integer('submission_id')
    .notNull()
    .references(() => submissions.id, { onDelete: 'cascade' })
});

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
    const queryClient = neon(process.env.NEON_DATABASE_URL || '');
    const db = drizzleNeon(queryClient);
    return db;
  } else {
    const queryClient = postgres(process.env.DATABASE_URL || '');
    const db = drizzlePostgres(queryClient);
    return db;
  }
}

// https://dev.to/noclat/fixing-too-many-connections-errors-with-database-clients-stacking-in-dev-mode-with-next-js-3kpm
function registerService(name: string, initFn: any) {
  const anyGlobal = global as any;
  if (process.env.NODE_ENV === 'development') {
    if (!(name in global)) {
      anyGlobal[name] = initFn();
    }
    return anyGlobal[name];
  }
  return initFn();
}

const db = registerService('db', getDB);
export default db;
