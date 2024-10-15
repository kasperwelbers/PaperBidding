import { NextResponse } from "next/server";
import db, {
  admins,
  projects,
  reviewers,
  projectAdmins,
  biddings,
} from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/auth/authOptions";

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
    .from(projectAdmins)
    .where(
      and(
        eq(projectAdmins.projectId, projectId),
        eq(projectAdmins.email, email),
      ),
    );
  return projectAdmin.length > 0;
}

export async function canCreateProject(email: string) {
  if (email === process.env.SUPERADMIN) return true;
  const admin = await db.select().from(admins).where(eq(admins.email, email));
  return admin.length > 0;
}

interface AuthenticatedReviewer {
  projectId: number;
  id: number;
  email: string;
  firstname: string;
  secret: string;
  biddings: number[];
}

export async function authenticateReviewer(req: Request) {
  const token = req.headers.get("Authorization");
  if (!token) return undefined;

  const [id, secret] = token.split("/");
  const reviewer = await db
    .select({
      projectId: reviewers.projectId,
      id: reviewers.id,
      email: reviewers.email,
      secret: reviewers.secret,
      biddings: biddings.submissionIds,
    })
    .from(reviewers)
    .where(eq(reviewers.id, Number(id)))
    .leftJoin(
      biddings,
      and(
        eq(biddings.projectId, reviewers.projectId),
        eq(biddings.email, reviewers.email),
      ),
    );

  let r = reviewer[0];

  if (r === undefined) return undefined;
  if (secret !== r.secret) return undefined;
  return r;
}
