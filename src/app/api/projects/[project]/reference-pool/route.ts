import db, { submissions } from "@/drizzle/schema";
import { authenticate, canEditProject } from "@/lib/authenticate";
import { referencePoolProjectId } from "@/lib/referencePool";
import { and, eq, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { NextResponse } from "next/server";

// copying a few thousand submissions is a single statement, but can take a bit
export const maxDuration = 60;

async function authorize(projectId: number) {
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });
  const canEdit = await canEditProject(email, projectId);
  if (!canEdit)
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });
  return null;
}

/** Whether central reference submissions are available, how many there are,
 *  and how many of them this project already has */
export async function GET(
  req: Request,
  props: { params: Promise<{ project: string }> },
) {
  const projectId = Number((await props.params).project);
  const denied = await authorize(projectId);
  if (denied) return denied;

  const poolId = referencePoolProjectId();
  if (!poolId || poolId === projectId)
    return NextResponse.json({ available: false, total: 0, inProject: 0 });

  const own = alias(submissions, "own");
  const [counts] = await db
    .select({
      total: sql<number>`count(*)::int`,
      inProject: sql<number>`count(${own.id})::int`,
    })
    .from(submissions)
    .leftJoin(
      own,
      and(
        eq(own.projectId, projectId),
        eq(own.submissionId, submissions.submissionId),
      ),
    )
    .where(eq(submissions.projectId, poolId));

  return NextResponse.json({
    available: counts.total > 0,
    total: counts.total,
    inProject: counts.inProject,
  });
}

/** Copy the central reference submissions (and their authors) into this
 *  project as reference submissions. Submissions the project already has are
 *  skipped, so this is safe to run again to pick up newly added ones */
export async function POST(
  req: Request,
  props: { params: Promise<{ project: string }> },
) {
  const projectId = Number((await props.params).project);
  const denied = await authorize(projectId);
  if (denied) return denied;

  const poolId = referencePoolProjectId();
  if (!poolId || poolId === projectId)
    return NextResponse.json(
      {},
      { statusText: "No reference submissions available", status: 404 },
    );

  // One statement, so submissions and authors are copied atomically
  const result = await db.execute(sql`
    WITH inserted AS (
      INSERT INTO submissions
        (project_id, submission_id, title, abstract, features, authors, institutions, is_reference)
      SELECT ${projectId}, submission_id, title, abstract, features, authors, institutions, true
      FROM submissions
      WHERE project_id = ${poolId}
      ON CONFLICT (project_id, submission_id) DO NOTHING
      RETURNING submission_id
    ),
    inserted_authors AS (
      INSERT INTO authors (project_id, submission_id, position, email, institution)
      SELECT DISTINCT ${projectId}::int, a.submission_id, a.position, a.email, a.institution
      FROM authors a
      JOIN inserted i ON i.submission_id = a.submission_id
      WHERE a.project_id = ${poolId}
      RETURNING 1
    )
    SELECT
      (SELECT count(*) FROM inserted)::int AS submissions,
      (SELECT count(*) FROM inserted_authors)::int AS authors
  `);

  // neon-http returns { rows }, postgres-js returns the rows as an array
  const rows: any[] = Array.isArray(result) ? result : (result as any).rows;
  return NextResponse.json(
    { added: rows?.[0]?.submissions ?? 0, authors: rows?.[0]?.authors ?? 0 },
    { status: 201 },
  );
}
