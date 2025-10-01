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
    .leftJoin(submissions, eq(authors.submissionId, submissions.submissionId))
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

  const conflictAuthors = db
    .selectDistinct({ email: authors.email })
    .from(authors)
    .where(
      or(
        inArray(authors.submissionId, submissionExternalIds),
        eq(authors.institution, reviewer.institution),
      ),
    )
    .as("conflictAuthors");

  const conflictSubmissions = await db
    .selectDistinct({ id: submissions.id })
    .from(authors)
    .innerJoin(conflictAuthors, eq(authors.email, conflictAuthors.email))
    .leftJoin(submissions, eq(authors.submissionId, submissions.submissionId));

  return NextResponse.json({
    id: reviewer.id,
    email: reviewer.email,
    bids: reviewer.biddings,
    submissionIds: ownSubmissions.map((s) => s.id),
    submissions: ownSubmissions,
    conflictSubmissionIds: conflictSubmissions.map((s) => s.id),
  });
}
