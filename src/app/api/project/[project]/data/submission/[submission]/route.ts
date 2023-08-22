import db, { submissions, projects } from '@/drizzle/schema';

import { sql, and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: { project: number; submission: number } }
) {
  const abstracts = await db
    .select({ abstract: submissions.abstract, token: projects.readToken })
    .from(submissions)
    .leftJoin(projects, eq(submissions.projectId, projects.id))
    .where(eq(submissions.id, Number(params.submission)));

  if (abstracts.length === 0)
    return NextResponse.json({}, { status: 404, statusText: 'Submission not found' });

  const abstract = abstracts[0];

  const readToken = req.headers.get('Authorization')?.slice(0, 32);
  if (abstract.token !== readToken)
    return NextResponse.json({}, { statusText: 'Invalid project read token', status: 403 });

  return NextResponse.json({ abstract: abstract.abstract });
}
