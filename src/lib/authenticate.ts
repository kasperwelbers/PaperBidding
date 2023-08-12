import { NextResponse } from 'next/server';
import db, { projects } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

export function authenticateAdmin(req: Request) {
  const token = req.headers.get('Authorization');
  if (token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({}, { statusText: 'Invalid Token', status: 403 });
  }
}

export async function authenticateProject(req: Request, projectId: number) {
  const token = req.headers.get('Authorization');
  const project = await db.select().from(projects).where(eq(projects.id, projectId));
  const p = project[0];
  if (p === undefined) return NextResponse.json({}, { statusText: 'Invalid Project', status: 404 });
  if (token !== p.token) {
    return NextResponse.json({}, { statusText: 'Invalid Token', status: 403 });
  }
}