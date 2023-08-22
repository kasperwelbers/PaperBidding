import { config } from 'dotenv';
import { InferModel } from 'drizzle-orm';
import {
  boolean,
  foreignKey,
  integer,
  jsonb,
  pgTable,
  primaryKey,
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
import { registerService } from '@/lib/utils';

config({ path: '.env.local' });

export const projects = pgTable('projects', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }).notNull().unique(),
  created: timestamp('created').notNull().defaultNow(),
  readToken: varchar('read_token', { length: 32 }).notNull(),
  editToken: varchar('edit_token', { length: 32 }).notNull()
});

// export const projectsRelations = relations(projects, ({ many }) => ({
//   submissions: many(submissions),
//   reviewers: many(reviewers)
// }));

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

// export const submissionsRelations = relations(submissions, ({ one, many }) => ({
//   project: one(projects, {
//     fields: [submissions.projectId],
//     references: [projects.id]
//   }),
//   authors: many(authors)
// }));

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

// export const authorsRelations = relations(authors, ({ one }) => ({
//   submissions: one(submissions, {
//     fields: [authors.submissionId],
//     references: [submissions.id]
//   }),
//   reviewers:
// }));

export const reviewers = pgTable('reviewers', {
  id: serial('id').primaryKey(),
  projectId: integer('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 256 }).notNull(),
  token: varchar('token', { length: 32 }).notNull(),
  importedFrom: varchar('imported_from', { length: 256 })
});

// export const reviewersRelations = relations(reviewers, ({ one }) => ({
//   project: one(projects, {
//     fields: [reviewers.projectId],
//     references: [projects.id]
//   }),
//   submissions:
// }));

export type Project = InferModel<typeof projects>;
export type NewProject = InferModel<typeof projects, 'insert'>;

export type Submission = InferModel<typeof submissions>;
export type NewSubmission = InferModel<typeof submissions, 'insert'>;

export type Author = InferModel<typeof authors>;
export type NewAuthor = InferModel<typeof authors, 'insert'>;

export type Reviewer = InferModel<typeof reviewers>;
export type NewReviewer = InferModel<typeof reviewers, 'insert'>;

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

const db = registerService('db', getDB);
export default db;
