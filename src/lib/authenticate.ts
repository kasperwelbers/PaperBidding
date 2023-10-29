import { NextResponse } from 'next/server';
import db, { admins, projects, reviewers, projectAdmins } from '@/drizzle/schema';
import { eq, and } from 'drizzle-orm';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/authOptions';

export async function authenticate() {
  const session = await getServerSession(authOptions);
  return session?.user || { email: undefined, canCreateProject: false };
}

export function isSuperAdmin(email: string) {
  return email === process.env.SUPERADMIN;
}

export async function canEditProject(email: string, projectId: number) {
  if (email === process.env.SUPERADMIN) return true;

  const projectAdmin = await db
    .select()
    .from(projects)
    .where(and(eq(projectAdmins.projectId, projectId), eq(projectAdmins.email, email)));
  return projectAdmin.length > 0;
}

export async function canCreateProject(email: string) {
  if (email === process.env.SUPERADMIN) return true;
  const admin = await db.select().from(admins).where(eq(admins.email, email));
  return admin.length > 0;
}

export async function authenticateReviewer(req: Request) {
  const token = req.headers.get('Authorization');
  if (!token) return undefined;

  const [id, secret] = token.split('/');
  const reviewer = await db
    .select()
    .from(reviewers)
    .where(eq(reviewers.id, Number(id)));
  let r = reviewer[0];

  if (r === undefined) return undefined;
  if (secret !== r.secret) return undefined;
  return r;
}
