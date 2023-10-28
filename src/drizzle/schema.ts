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
  unique
} from 'drizzle-orm/pg-core';

import { neon } from '@neondatabase/serverless';
import postgres from 'postgres';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePostgres } from 'drizzle-orm/postgres-js';

config({ path: '.env.local' });

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }).notNull().unique(),
  created: timestamp('created').notNull().defaultNow(),
  readToken: varchar('read_token', { length: 32 }).notNull(),
  editToken: varchar('edit_token', { length: 32 }).notNull()
});

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
    isReference: boolean('is_reference').notNull().default(false)
  },
  (table) => {
    return {
      unq: unique().on(table.projectId, table.submissionId)
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
      }).onDelete('cascade')
    };
  }
);

export const reviewers = pgTable('reviewers', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 256 }).notNull(),
  token: varchar('token', { length: 32 }).notNull(),
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
