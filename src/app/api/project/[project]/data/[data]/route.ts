import db, { project, submission, volunteer } from '@/drizzle/schema';
import cryptoRandomString from 'crypto-random-string';
import { and, eq, sql } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { project: number; data: string } }) {
  await authenticate(params.project);

  if (!['submissions', 'volunteers', 'references'].includes(params.data)) {
    return NextResponse.json({}, { statusText: 'Invalid Request', status: 400 });
  }

  if (params.data === 'volunteers') {
    const data = await db
      .select({ count: sql<number>`count(${volunteer.email})` })
      .from(volunteer)
      .where(eq(volunteer.projectId, params.project));
    return NextResponse.json({ count: Number(data[0].count) });
  }
  if (params.data === 'submissions' || params.data === 'references') {
    const isReference = params.data === 'references';
    const data = await db
      .select({ count: sql<number>`count(${submission.id})` })
      .from(submission)
      .where(eq(submission.isReference, isReference))
      .where(eq(submission.projectId, params.project));
    return NextResponse.json({ count: Number(data[0].count) });
  }

  return NextResponse.json({}, { status: 400 });
}

export async function POST(
  req: Request,
  { params }: { params: { project: number; data: string } }
) {
  await authenticate(params.project);

  const { data } = await req.json();

  try {
    if (params.data === 'volunteers') {
      const volunteerData = data.map((d: any) => ({
        ...d,
        projectId: params.project,
        token: cryptoRandomString({ length: 32 })
      }));
      await db.delete(volunteer).where(eq(volunteer.projectId, params.project));
      await db.insert(volunteer).values(volunteerData);
      return NextResponse.json({ status: 201 });
    }

    if (params.data === 'submissions' || params.data === 'references') {
      const submissionData = data.map((d: any) => ({
        ...d,
        projectId: params.project,
        isReference: params.data === 'references'
      }));
      await db
        .delete(submission)
        .where(
          and(
            eq(submission.projectId, params.project),
            eq(submission.isReference, params.data === 'references')
          )
        );
      await db.insert(submission).values(submissionData);
      return NextResponse.json({ status: 201 });
    }
  } catch (e: any) {
    console.error(e.message);
    return NextResponse.json({}, { status: 400, statusText: 'invalid payload' });
  }

  return NextResponse.json({}, { status: 400 });
}

async function authenticate(projectId: number) {
  const headersList = headers();
  const token = headersList.get('Authorization');
  const projects = await db.select().from(project).where(eq(project.id, projectId));
  const p = projects[0];
  if (p === undefined) return NextResponse.json({}, { statusText: 'Invalid Project', status: 404 });
  if (token !== p.token) {
    return NextResponse.json({}, { statusText: 'Invalid Token', status: 403 });
  }
}
