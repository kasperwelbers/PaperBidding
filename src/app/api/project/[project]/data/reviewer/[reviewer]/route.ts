import db, { authors, submissions } from '@/drizzle/schema';
import { authenticateReviewer } from '@/lib/authenticate';

import { and, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: { project: number; reviewer: number } }
) {
  const projectId = Number(params.project);
  const reviewerId = Number(params.reviewer);
  const { reviewer, error } = await authenticateReviewer(req, reviewerId);
  if (error) return error;

  if (reviewer.projectId !== projectId)
    return NextResponse.json({}, { status: 404, statusText: 'Invalid project X reviewer' });

  const ownSubmissions = await db
    .select({ id: submissions.id, externalId: submissions.submissionId })
    .from(authors)
    .leftJoin(submissions, eq(authors.submissionId, submissions.submissionId))
    .where(and(eq(authors.projectId, projectId), eq(authors.email, reviewer.email)));

  const submissionExternalIds = ownSubmissions.map((s) => s.externalId);

  const coAuthors = db
    .selectDistinct({ email: authors.email })
    .from(authors)
    .where(inArray(authors.submissionId, submissionExternalIds))
    .as('coAuthors');

  const coAuthorSubmissions = await db
    .selectDistinct({ id: submissions.id })
    .from(authors)
    .innerJoin(coAuthors, eq(authors.email, coAuthors.email))
    .leftJoin(submissions, eq(authors.submissionId, submissions.submissionId));

  return NextResponse.json({
    id: reviewer.id,
    email: reviewer.email,
    bids: [],
    submissionIds: ownSubmissions.map((s) => s.id),
    coAuthorSubmissionIds: coAuthorSubmissions.map((s) => s.id)
  });
}
