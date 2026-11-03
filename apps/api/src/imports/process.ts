// Import processing, in queue steps:
//   parse:  read the file from R2, parse it with the platform adapter, and
//           store the normalized records in R2 in chunks
//   write:  write one chunk to D1, then queue the next chunk
// Chunks are written one after the other, so persons are never created twice

import { eq } from "drizzle-orm";
import { applyMapping, parseCsv, type PersonRecord, type ReviewerRecord, type SubmissionRecord } from "@cp/shared";
import { conferences, createDb, editions, importJobs, type Db } from "@cp/db";
import { scholarOneAdapter } from "@cp/adapter-scholarone";
import { chunk } from "./d1";
import { writePersons, writeReviewers, writeSubmissions, type ChunkResult } from "./write";

export const RECORDS_PER_CHUNK = 200;

export type ImportMessage =
  | { jobId: number; step: "parse" }
  | { jobId: number; step: "write"; chunk: number };

/** In tests (ENVIRONMENT = "test") messages are kept here, and processed with
 *  drainTestQueue, so tests are deterministic */
export const testQueue: ImportMessage[] = [];

export async function enqueue(env: Env, message: ImportMessage) {
  if (env.ENVIRONMENT === "test") testQueue.push(message);
  else await env.IMPORTS.send(message);
}

export async function drainTestQueue(env: Env) {
  while (testQueue.length > 0) await processImportMessage(env, testQueue.shift()!);
}

/** The folder of a job in R2 */
export function jobFolder(conferenceId: number, editionId: number, jobId: number) {
  return `conferences/${conferenceId}/editions/${editionId}/imports/${jobId}`;
}

async function loadJob(db: Db, jobId: number) {
  const job = await db.query.importJobs.findFirst({ where: eq(importJobs.id, jobId) });
  if (!job) return null;
  const edition = await db.query.editions.findFirst({ where: eq(editions.id, job.editionId) });
  const conference = edition
    ? await db.query.conferences.findFirst({ where: eq(conferences.id, edition.conferenceId) })
    : undefined;
  if (!edition || !conference) return null;
  return { job, edition, conference };
}

async function updateJob(db: Db, jobId: number, values: Partial<typeof importJobs.$inferInsert>) {
  await db
    .update(importJobs)
    .set({ ...values, updatedAt: new Date() })
    .where(eq(importJobs.id, jobId));
}

function mergeCounts(a: Record<string, number>, b: Record<string, number>) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = (out[k] ?? 0) + v;
  return out;
}

export async function processImportMessage(env: Env, message: ImportMessage) {
  const db = createDb(env.DB);
  const loaded = await loadJob(db, message.jobId);
  if (!loaded) return; // job deleted
  const { job, edition, conference } = loaded;
  const folder = jobFolder(conference.id, edition.id, job.id);
  const settings = scholarOneAdapter.resolveSettings(conference.settings);

  try {
    if (message.step === "parse") {
      await updateJob(db, job.id, { status: "parsing", error: null });
      const file = await env.FILES.get(job.fileKey);
      if (!file) throw new Error("The uploaded file is missing");
      const csv = parseCsv(await file.text());
      const spec = scholarOneAdapter.imports[job.kind];
      const parsed = spec.parse(applyMapping(csv, job.mapping ?? {}), settings) as {
        records: unknown[];
        warnings: string[];
      };
      const chunks = chunk(parsed.records, RECORDS_PER_CHUNK);
      for (let i = 0; i < chunks.length; i++)
        await env.FILES.put(`${folder}/records/${i}.json`, JSON.stringify(chunks[i]));

      await updateJob(db, job.id, {
        status: chunks.length > 0 ? "writing" : "done",
        totalChunks: chunks.length,
        doneChunks: 0,
        counts: { rows: csv.rows.length, records: parsed.records.length },
        warnings: parsed.warnings,
      });
      if (chunks.length > 0) await enqueue(env, { jobId: job.id, step: "write", chunk: 0 });
      return;
    }

    // write one chunk
    const file = await env.FILES.get(`${folder}/records/${message.chunk}.json`);
    if (!file) throw new Error(`Records chunk ${message.chunk} is missing`);
    const records = (await file.json()) as unknown[];
    const ctx = { conferenceId: conference.id, editionId: edition.id, importJobId: job.id };

    let result: ChunkResult;
    if (job.kind === "submissions")
      result = await writeSubmissions(db, ctx, records as SubmissionRecord[]);
    else if (job.kind === "persons") result = await writePersons(db, ctx, records as PersonRecord[]);
    else result = await writeReviewers(db, ctx, records as ReviewerRecord[], settings);

    const doneChunks = message.chunk + 1;
    const last = doneChunks >= (job.totalChunks ?? 0);
    await updateJob(db, job.id, {
      status: last ? "done" : "writing",
      doneChunks,
      counts: mergeCounts(job.counts, result.counts),
      warnings: [...new Set([...job.warnings, ...result.warnings])],
    });
    if (!last) await enqueue(env, { jobId: job.id, step: "write", chunk: doneChunks });
  } catch (e) {
    console.error(`import ${job.id} failed`, e);
    await updateJob(db, job.id, {
      status: "failed",
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
