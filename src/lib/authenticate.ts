import { NextResponse } from 'next/server';
import db, { projects, reviewers } from '@/drizzle/schema';
import { eq } from 'drizzle-orm';

export function authenticateAdmin(req: Request) {
  const token = req.headers.get('Authorization');
  if (token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({}, { statusText: 'Invalid Token', status: 403 });
  }
}

export async function authenticateProject(req: Request, projectId: number, edit: boolean) {
  const token = req.headers.get('Authorization')?.slice(0, 32);
  const project = await db.select().from(projects).where(eq(projects.id, projectId));
  let p = project[0];
  let error: any;
  let editRight = false;

  if (p === undefined) {
    error = NextResponse.json({}, { statusText: 'Project not found', status: 404 });
    return { project: p, editRight, error };
  }

  if (edit) {
    if (token !== p.editToken)
      error = NextResponse.json({}, { statusText: 'Invalid project edit token', status: 403 });
    editRight = true;
  } else {
    if (token !== p.readToken && token !== p.editToken)
      error = NextResponse.json({}, { statusText: 'Invalid project read token', status: 403 });
    if (token === p.editToken) {
      editRight = true;
    }
  }

  return { project: p, editRight, error };
}

export async function authenticateReviewer(req: Request, reviewerId: number) {
  const token = req.headers.get('Authorization')?.slice(32, 64);
  const reviewer = await db.select().from(reviewers).where(eq(reviewers.id, reviewerId));
  let r = reviewer[0];
  let error: any;

  if (r === undefined) {
    error = NextResponse.json({}, { statusText: 'Reviewer not found', status: 404 });
    return { reviewer: r, error };
  }

  if (token !== r.token)
    error = NextResponse.json({}, { statusText: 'Invalid reviewer token', status: 403 });

  return { reviewer: r, error };
}
