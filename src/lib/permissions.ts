import db, { admins, projectAdmins } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";

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

/** Whether the user is an admin of at least one project */
export async function isAnyProjectAdmin(email: string) {
  if (email === process.env.SUPERADMIN) return true;
  const projectAdmin = await db
    .select({ id: projectAdmins.id })
    .from(projectAdmins)
    .where(eq(projectAdmins.email, email))
    .limit(1);
  return projectAdmin.length > 0;
}
