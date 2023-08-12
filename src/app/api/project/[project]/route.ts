import db, { projects } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { project: number } }) {
  const project = await db.select().from(projects).where(eq(projects.id, params.project));
  const p = project[0];

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
