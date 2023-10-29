import db, { projects } from '@/drizzle/schema';
import { authenticate, canEditProject } from '@/lib/authenticate';
import { eq } from 'drizzle-orm';

import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { project: number } }) {
  const { email } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit) return NextResponse.json({}, { statusText: 'Not authorized', status: 403 });

  const project = await db.select().from(projects).where(eq(projects.id, params.project));
  const p = project[0];
  if (!p) return NextResponse.json({}, { statusText: 'Not found', status: 404 });
  return NextResponse.json(p);
}
