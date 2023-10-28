import db, {
  NewSubmission,
  NewAuthor,
  NewReviewer,
  submissions,
  reviewers,
  authors
} from '@/drizzle/schema';
import { authenticateProject } from '@/lib/authenticate';
import { SubmissionsSchema } from '@/zodSchemas';
import cryptoRandomString from 'crypto-random-string';
import { sql, and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { project: number } }) {
  const { editRight, error } = await authenticateProject(req, params.project, false);
  if (error) return error;
  const searchParams = new URL(req.url).searchParams;
  const offset = Number(searchParams.get('offset')) || 0;
  const limit = Number(searchParams.get('limit')) || 10;
  const reference = !!searchParams.get('reference');

  if (!editRight && reference) {
    // project read token can only be used to get the normal submissions
    return NextResponse.json(
      { error: 'not authorized' },
      { status: 403, statusText: 'not authorized' }
    );
  }

  const selection = db.$with('sq').as(
    db
      .select()
      .from(submissions)
      .where(and(eq(submissions.isReference, reference), eq(submissions.projectId, params.project)))
  );

  const rowsPromise = db
    .with(selection)
    .select({
      id: selection.id,
      title: selection.title,
      features: selection.features
    })
    .from(selection)
    .orderBy(selection.id)
    .offset(offset)
    .limit(limit);
  const metaPromise = db
    .with(selection)
    .select({ count: sql<number>`count(*)` })
    .from(selection);
  const [rows, meta] = await Promise.all([rowsPromise, metaPromise]);

  return NextResponse.json({ rows, meta: meta[0] });
}

export async function POST(req: Request, { params }: { params: { project: number } }) {
  const { editRight, error } = await authenticateProject(req, params.project, true);
  if (error) return error;
  const { data } = await req.json();
  const searchParams = new URL(req.url).searchParams;
  const reference = !!searchParams.get('reference');

  const newSubmissions: NewSubmission[] = [];
  const newAuthors: NewAuthor[] = [];
  const newReviewers: NewReviewer[] = [];
  const validData = SubmissionsSchema.safeParse(data);

  if (!validData.success)
    return NextResponse.json(validData, {
      statusText: 'Invalid payload',
      status: 400
    });

  for (let row of validData.data) {
    newSubmissions.push({
      projectId: params.project,
      submissionId: row.id,
      title: row.title,
      abstract: row.abstract,
      features: row.features,
      isReference: reference
    });

    for (let author of row.authors) {
      newAuthors.push({
        projectId: params.project,
        submissionId: row.id,
        email: author
      });
      newReviewers.push({
        projectId: params.project,
        email: author,
        token: cryptoRandomString({ length: 32, type: 'url-safe' }),
        importedFrom: reference ? 'reference' : 'submission'
      });
    }
  }

  if (reference) {
    // if we are importing the reference, we don't want to overwrite existing submissions
    await db.insert(submissions).values(newSubmissions).onConflictDoNothing();
  } else {
    // but if we are importing submissions, we want to overwrite the reference. This way,
    // submissions will always be included as non-reference submissions
    await db
      .insert(submissions)
      .values(newSubmissions)
      .onConflictDoUpdate({
        target: [submissions.projectId, submissions.submissionId],
        set: { isReference: false }
      });
  }
  await db.insert(authors).values(newAuthors);
  await db.insert(reviewers).values(newReviewers);
  return NextResponse.json({ status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { project: number } }) {
  await authenticateProject(req, params.project, true);
  const searchParams = new URL(req.url).searchParams;
  const reference = !!searchParams.get('reference');

  await db
    .delete(submissions)
    .where(and(eq(submissions.projectId, params.project), eq(submissions.isReference, reference)));
  await db
    .delete(reviewers)
    .where(
      and(
        eq(reviewers.projectId, params.project),
        eq(reviewers.importedFrom, reference ? 'reference' : 'submission')
      )
    );
  return NextResponse.json({}, { status: 201 });
}
