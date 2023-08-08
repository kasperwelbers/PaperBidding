import { config } from 'dotenv';
import { InferModel } from 'drizzle-orm';
import {
  boolean,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  varchar
} from 'drizzle-orm/pg-core';

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

config({ path: '.env.local' });

export const project = pgTable('project', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 256 }).notNull().unique(),
  created: timestamp('created').notNull().defaultNow(),
  token: varchar('token', { length: 32 }).notNull()
});

export const submission = pgTable('submission', {
  id: serial('id').primaryKey(),
  projectId: integer('projectId').references(() => project.id),
  external_id: varchar('id', { length: 256 }).primaryKey(),
  title: text('title').notNull(),
  abstract: text('abstract').notNull(),
  features: jsonb('features').notNull(),
  /** also allow uploading reference submissions that are only used for matching volunteers */
  isReference: boolean('isReference').notNull().default(false)
});

export const author = pgTable(
  'author',
  {
    submissionId: integer('submissionId').notNull(),
    email: varchar('email', { length: 256 }).notNull()
  },
  (table) => {
    return {
      pk: primaryKey(table.submissionId, table.email)
    };
  }
);

export const volunteer = pgTable(
  'volunteer',
  {
    projectId: integer('projectId').notNull(),
    email: varchar('email', { length: 256 }).notNull(),
    token: varchar('token', { length: 32 }).notNull()
  },
  (table) => {
    return {
      pk: primaryKey(table.projectId, table.email)
    };
  }
);

export type Project = InferModel<typeof project>;
export type Submission = InferModel<typeof submission>;
export type Author = InferModel<typeof author>;
export type Volunteer = InferModel<typeof volunteer>;

const sql = neon(process.env.DATABASE_URL || '');
const db = drizzle(sql);
export default db;
