import db, { projectAdmins, projects } from '@/drizzle/schema';
import { authenticate, canEditProject } from '@/lib/authenticate';
import { eq } from 'drizzle-orm';
import { GetProject } from '@/types';

import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { project: number } }) {
  const { email } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit) return NextResponse.json({}, { statusText: 'Not authorized', status: 403 });

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.project))
    .leftJoin(projectAdmins, eq(projectAdmins.projectId, projects.id));
  const p: any = project[0].projects;
  if (!p) return NextResponse.json({}, { statusText: 'Not found', status: 404 });

  p.admins = project.map((p: any) => p.project_admins.email);

  return NextResponse.json(p);
}
