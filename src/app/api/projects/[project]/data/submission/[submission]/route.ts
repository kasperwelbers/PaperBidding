import db, { submissions, projects } from "@/drizzle/schema";
import { authenticateReviewer } from "@/lib/authenticate";

import { sql, and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  props: { params: Promise<{ project: string; submission: string }> },
) {
  const params = await props.params;
  const submissionId = Number(params.submission);
  const reviewer = await authenticateReviewer(req);
  if (!reviewer)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const abstracts = await db
    .select({ abstract: submissions.abstract })
    .from(submissions)
    .leftJoin(projects, eq(submissions.projectId, reviewer.projectId))
    .where(eq(submissions.id, submissionId))
    .orderBy(submissions.id);

  if (abstracts.length === 0)
    return NextResponse.json(
      {},
      { status: 404, statusText: "Submission not found" },
    );

  const abstract = abstracts[0];

  return NextResponse.json({ abstract: abstract.abstract });
}
