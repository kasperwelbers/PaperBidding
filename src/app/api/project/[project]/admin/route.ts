import db, { projectAdmins, projects } from '@/drizzle/schema';
import { authenticate, canEditProject } from '@/lib/authenticate';
import { eq } from 'drizzle-orm';

import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: { project: number } }) {
  const { email } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit) return NextResponse.json({}, { statusText: 'Not authorized', status: 403 });

  const { email: admin } = await req.json();
  await db.insert(projectAdmins).values({ projectId: params.project, email: admin });

  return NextResponse.json({}, { status: 201 });
}
