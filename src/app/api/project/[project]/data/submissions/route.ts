import db, {
  NewSubmission,
  NewAuthor,
  NewReviewer,
  submissions,
  reviewers,
  authors
} from '@/drizzle/schema';
import { authenticate, authenticateReviewer, canEditProject } from '@/lib/authenticate';
import { SubmissionsSchema } from '@/zodSchemas';
import cryptoRandomString from 'crypto-random-string';
import { sql, and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { project: number } }) {
  const { email } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });

  const canEdit = await canEditProject(email, params.project);
  const searchParams = new URL(req.url).searchParams;

  const offset = Number(searchParams.get('offset')) || 0;
  const limit = Number(searchParams.get('limit')) || 10;
  const reference = !!searchParams.get('reference');
  const metadata = !!searchParams.get('meta');

  if (!canEdit) {
    // reviewers can also GET submission, but not the reference submissions,
    // and not the meta
    const reviewer = await authenticateReviewer(req);
    if (!reviewer || reference || metadata)
      return NextResponse.json({ error: 'not authorized' }, { status: 403 });
  }

  const selection = db.$with('sq').as(
    db
      .select()
      .from(submissions)
      .where(and(eq(submissions.isReference, reference), eq(submissions.projectId, params.project)))
  );

  const fields: any = {
    id: selection.id,
    title: selection.title
  };
  if (metadata) {
    fields.submissionId = selection.submissionId;
  } else {
    fields.features = selection.features;
  }

  const rowsPromise = db
    .with(selection)
    .select(fields)
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
  const { email } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit) return NextResponse.json({}, { statusText: 'Not authorized', status: 403 });

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
        email: author.email
      });
      newReviewers.push({
        projectId: params.project,
        email: author.email,
        firstname: author.firstname,
        secret: cryptoRandomString({ length: 32, type: 'url-safe' }),
        biddings: [],
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
  const { email } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit) return NextResponse.json({}, { statusText: 'Not authorized', status: 403 });

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
