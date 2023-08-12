import db, {
  NewSubmission,
  NewVolunteer,
  NewAuthor,
  submissions,
  volunteers,
  authors
} from '@/drizzle/schema';
import { authenticateProject } from '@/lib/authenticate';
import { SubmissionsSchema, VolunteersSchema } from '@/schemas';
import cryptoRandomString from 'crypto-random-string';
import { and, eq, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { project: number; data: string } }) {
  await authenticateProject(req, params.project);

  if (!['submissions', 'volunteers', 'references'].includes(params.data)) {
    return NextResponse.json({}, { statusText: 'Invalid Request', status: 400 });
  }

  if (params.data === 'volunteers') {
    const data = await db
      .select({ count: sql<number>`count(${volunteers.email})` })
      .from(volunteers)
      .where(eq(volunteers.projectId, params.project));
    return NextResponse.json({ count: Number(data[0].count) });
  }
  if (params.data === 'submissions' || params.data === 'references') {
    const isReference = params.data === 'references';
    const data = await db
      .select({ count: sql<number>`count(${submissions.id})` })
      .from(submissions)
      .where(
        and(eq(submissions.isReference, isReference), eq(submissions.projectId, params.project))
      );
    return NextResponse.json({ count: Number(data[0].count) });
  }

  return NextResponse.json({}, { status: 400 });
}

export async function POST(
  req: Request,
  { params }: { params: { project: number; data: string } }
) {
  await authenticateProject(req, params.project);

  const { data } = await req.json();

  try {
    if (params.data === 'volunteers') await insertVolunteers(data, params.project);
    if (params.data === 'submissions' || params.data === 'references') {
      await insertSubmissions(data, params.project, params.data === 'references');
    }
  } catch (e: any) {
    console.error(e.message);
    return NextResponse.json({ error: e.message }, { status: 400, statusText: 'invalid payload' });
  }

  return NextResponse.json({}, { status: 400 });
}

export async function DELETE(
  req: Request,
  { params }: { params: { project: number; data: string } }
) {
  await authenticateProject(req, params.project);

  if (params.data === 'volunteers') {
    await db.delete(volunteers).where(eq(volunteers.projectId, params.project));
    return NextResponse.json({}, { status: 204 });
  }
  if (params.data === 'submissions' || params.data === 'references') {
    const isReference = params.data === 'references';
    await db
      .delete(submissions)
      .where(
        and(eq(submissions.projectId, params.project), eq(submissions.isReference, isReference))
      );
    return NextResponse.json({}, { status: 204 });
  }

  return NextResponse.json({}, { status: 400 });
}

async function insertVolunteers(data: any, projectId: number) {
  const validData = VolunteersSchema.parse(data);
  const newVolunteers: NewVolunteer[] = validData.map((d: any) => ({
    email: d.email,
    projectId,
    token: cryptoRandomString({ length: 32 })
  }));
  await db.insert(volunteers).values(newVolunteers);
  return NextResponse.json({ status: 201 });
}

async function insertSubmissions(data: any, projectId: number, isReference: boolean) {
  const newSubmissions: NewSubmission[] = [];
  const newAuthors: NewAuthor[] = [];

  const validData = SubmissionsSchema.parse(data);

  for (let row of validData) {
    newSubmissions.push({
      projectId,
      submissionId: row.id,
      title: row.title,
      abstract: row.abstract,
      features: row.features,
      isReference
    });

    for (let author of row.authors) {
      newAuthors.push({
        projectId,
        submissionId: row.id,
        email: author
      });
    }
  }

  await db.insert(submissions).values(newSubmissions);
  await db.insert(authors).values(newAuthors);
  return NextResponse.json({ status: 201 });
}
