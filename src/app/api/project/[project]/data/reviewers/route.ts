import db, { projects, reviewers, NewReviewer, submissions, authors } from '@/drizzle/schema';
import { authenticate, canEditProject } from '@/lib/authenticate';
import { GetReviewer } from '@/types';
import { ReviewersSchema } from '@/zodSchemas';
import cryptoRandomString from 'crypto-random-string';
import { and, sql, eq, inArray } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { project: number } }) {
  const { email } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit) return NextResponse.json({}, { statusText: 'Not authorized', status: 403 });

  const searchParams = new URL(req.url).searchParams;
  const offset = Number(searchParams.get('offset')) || 0;
  const limit = Number(searchParams.get('limit')) || 10;
  const importedFrom = getImportedFrom(searchParams);

  const rowsPromise = db
    .selectDistinctOn([reviewers.email], {
      id: reviewers.id,
      email: reviewers.email,
      firstname: reviewers.firstname,
      link: reviewers.secret,
      invitationSent: reviewers.invitationSent,
      biddings: reviewers.biddings,
      submission: {
        id: submissions.id,
        submissionId: submissions.submissionId,
        features: submissions.features,
        authors: submissions.authors
      }
    })
    .from(reviewers)
    .where(
      and(eq(reviewers.projectId, params.project), inArray(reviewers.importedFrom, importedFrom))
    )
    .orderBy(reviewers.email)
    .offset(offset)
    .limit(limit)
    .leftJoin(
      authors,
      and(eq(authors.projectId, reviewers.projectId), eq(authors.email, reviewers.email))
    )
    .leftJoin(
      submissions,
      and(
        eq(submissions.projectId, authors.projectId),
        eq(submissions.submissionId, authors.submissionId)
      )
    );

  const metaPromise = db
    .select({ count: sql<number>`count(distinct email)` })
    .from(reviewers)
    .where(
      and(eq(reviewers.projectId, params.project), inArray(reviewers.importedFrom, importedFrom))
    );
  const [rowResults, meta] = await Promise.all([rowsPromise, metaPromise]);

  const rows: Record<string, GetReviewer> = {};
  const domain = new URL(req.url).origin;
  for (let row of rowResults) {
    if (!rows[row.id]) {
      rows[row.email] = {
        id: row.id,
        email: row.email,
        firstname: row.firstname,
        link: domain + `/bidding/${params.project}/${row.id}/${row.link}`,
        invitationSent: row.invitationSent,
        biddings: row.biddings,
        manualBiddings: row.biddings.length,
        coAuthors: [],
        submissions: []
      };
    }
    if (row.submission) {
      rows[row.email].submissions.push({
        id: row.submission.id,
        submissionId: row.submission.submissionId,
        features: row.submission.features
      });

      for (let author of row.submission.authors) {
        if (!rows[row.email].coAuthors.includes(author.email)) {
          rows[row.email].coAuthors.push(author.email);
        }
      }
    }
  }

  return NextResponse.json({ rows: Object.values(rows), meta: meta[0] });
}

export async function POST(req: Request, { params }: { params: { project: number } }) {
  const { email } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit) return NextResponse.json({}, { statusText: 'Not authorized', status: 403 });

  const { data } = await req.json();
  const searchParams = new URL(req.url).searchParams;
  const volunteer = !!searchParams.get('volunteer') ? 'volunteer' : null;
  const submission = !!searchParams.get('submission') ? 'submission' : null;
  const reference = !!searchParams.get('reference') ? 'reference' : null;

  const validData = ReviewersSchema.safeParse(data);
  if (!validData.success)
    return NextResponse.json(validData.error, {
      statusText: 'invalid payload',
      status: 400
    });

  const newReviewers: NewReviewer[] = validData.data.map((d: any) => ({
    email: d.email,
    firstname: d.firstname,
    projectId: params.project,
    importedFrom: volunteer || submission || reference || 'volunteer',
    biddings: [],
    secret: cryptoRandomString({ length: 32, type: 'url-safe' })
  }));
  await db.insert(reviewers).values(newReviewers);
  return NextResponse.json({ status: 201 });
}

export async function DELETE(req: Request, { params }: { params: { project: number } }) {
  const { email } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit) return NextResponse.json({}, { statusText: 'Not authorized', status: 403 });

  const searchParams = new URL(req.url).searchParams;
  const importedFrom = getImportedFrom(searchParams);

  await db
    .delete(reviewers)
    .where(
      and(eq(reviewers.projectId, params.project), inArray(reviewers.importedFrom, importedFrom))
    );
  return NextResponse.json({}, { status: 201 });
}

function getImportedFrom(searchParams: URLSearchParams) {
  // In GET and DELETE
  // reviewers endpoint can have parameters volunteer, submission, reference.
  // these are used to filter reviewers on the basis of their importedFrom field.
  // If none of them are present, then all three are assumed.
  const volunteer = !!searchParams.get('volunteer');
  const submission = !!searchParams.get('submission');
  const reference = !!searchParams.get('reference');
  const importedFrom = [];
  if (!volunteer && !submission && !reference) {
    importedFrom.push('volunteer', 'submission', 'reference');
  } else {
    if (volunteer) importedFrom.push('volunteer');
    if (submission) importedFrom.push('submission');
    if (reference) importedFrom.push('reference');
  }
  return importedFrom;
}
