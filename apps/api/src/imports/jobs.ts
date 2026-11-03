import { eq } from "drizzle-orm";
import { detectColumns } from "@cp/shared";
import { scholarOneAdapter } from "@cp/adapter-scholarone";
import { conferences, importJobs, type Db } from "@cp/db";
import { enqueue, jobFolder } from "./process";

/** Creates and starts an import from a CSV text, with the detected column
 *  mapping (used by the demo) */
export async function startImportFromText(
  env: Env,
  db: Db,
  args: {
    conferenceId: number;
    editionId: number;
    kind: "submissions" | "persons" | "reviewers";
    filename: string;
    text: string;
    createdBy: string;
  },
) {
  const conference = await db.query.conferences.findFirst({ where: eq(conferences.id, args.conferenceId) });
  const settings = scholarOneAdapter.resolveSettings(conference?.settings);
  const headers = args.text.split("\n", 1)[0]!.split(",");
  const mapping = detectColumns(headers, scholarOneAdapter.imports[args.kind].fields(settings));

  const [job] = await db
    .insert(importJobs)
    .values({
      editionId: args.editionId,
      kind: args.kind,
      status: "queued",
      filename: args.filename,
      fileKey: "",
      size: args.text.length,
      mapping,
      createdBy: args.createdBy,
    })
    .returning();
  const fileKey = `${jobFolder(args.conferenceId, args.editionId, job!.id)}/source.csv`;
  await env.FILES.put(fileKey, args.text);
  await db.update(importJobs).set({ fileKey }).where(eq(importJobs.id, job!.id));
  await enqueue(env, { jobId: job!.id, step: "parse" });
  return job!.id;
}
