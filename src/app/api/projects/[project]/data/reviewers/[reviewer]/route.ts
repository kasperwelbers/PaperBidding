import db, { authors, submissions, Submission } from "@/drizzle/schema";
import { authenticateReviewer } from "@/lib/authenticate";

import { and, eq, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  props: { params: Promise<{ project: string; reviewer: string }> },
) {
  const params = await props.params;
  const projectId = Number(params.project);

  const reviewer = await authenticateReviewer(req);
  if (!reviewer)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  if (reviewer.projectId !== projectId)
    return NextResponse.json(
      {},
      { status: 404, statusText: `Invalid project ${projectId} reviewer` },
    );

  const ownSubmissions = await db
    .select({
      id: submissions.id,
      submissionId: submissions.submissionId,
      title: submissions.title,
      features: submissions.features,
    })
    .from(authors)
    .leftJoin(
      submissions,
      and(
        eq(submissions.projectId, authors.projectId),
        eq(submissions.submissionId, authors.submissionId),
      ),
    )
    .where(
      and(eq(authors.projectId, projectId), eq(authors.email, reviewer.email)),
    );

  const submissionExternalIds: string[] = [];
  for (let s of ownSubmissions) {
    if (s.submissionId !== null) {
      submissionExternalIds.push(s.submissionId);
    }
  }

  if (submissionExternalIds.length === 0) {
    return NextResponse.json({
      id: reviewer.id,
      email: reviewer.email,
      bids: reviewer.biddings,
      submissionIds: [],
      submissions: [],
      conflictSubmissionIds: [],
    });
  }

  // All queries are scoped to this project. Control IDs can occur in many
  // projects (e.g., as reference submissions), so joining on control ID alone
  // would pull in (duplicate) rows from every project in the system
  const conflictAuthors = db
    .selectDistinct({ email: authors.email })
    .from(authors)
    .where(
      and(
        eq(authors.projectId, projectId),
        or(
          inArray(authors.submissionId, submissionExternalIds),
          // an empty institution (e.g., self-registered volunteers) is not a conflict
          reviewer.institution
            ? eq(authors.institution, reviewer.institution)
            : undefined,
        ),
      ),
    )
    .as("conflictAuthors");

  const conflictSubmissions = await db
    .selectDistinct({ id: submissions.id })
    .from(authors)
    .innerJoin(conflictAuthors, eq(authors.email, conflictAuthors.email))
    .innerJoin(
      submissions,
      and(
        eq(submissions.projectId, authors.projectId),
        eq(submissions.submissionId, authors.submissionId),
      ),
    )
    .where(eq(authors.projectId, projectId));

  return NextResponse.json({
    id: reviewer.id,
    email: reviewer.email,
    bids: reviewer.biddings,
    submissionIds: ownSubmissions.map((s) => s.id),
    submissions: ownSubmissions,
    conflictSubmissionIds: conflictSubmissions.map((s) => s.id),
  });
}
