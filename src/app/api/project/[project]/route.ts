import db, { project } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

// simply make project endpoint:
// - verify token
// - if verified, return all submissions and user submissions

// token should just be a 32bit or so string, not a jwt
// should be a projectuser table to match token,
// that joins with a userSubmissions table
// that joins with the submissions

// On the bidding page, have a sidebar with reference submissions, which
// are all users own submissions. They can disable them, and
// also select other submissions as additional reference submissions.

export async function GET(req: Request, { params }: { params: { project: number } }) {
  const projects = await db.select().from(project).where(eq(project.id, params.project));
  const p = projects[0];

  if (p === undefined) return NextResponse.json({}, { statusText: 'Invalid Project', status: 404 });

  const headersList = headers();
  const token = headersList.get('Authorization');

  if (token !== p.token) {
    return NextResponse.json({}, { statusText: 'Invalid Token', status: 403 });
  }

  return NextResponse.json(p);
}

export async function POST(req: Request) {
  return NextResponse.json({ status: 201 });
}
