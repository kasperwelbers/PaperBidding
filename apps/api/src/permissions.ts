// All access checks. Access is open within a conference (see the plan,
// section 3): everyone with a role can view everything, conference admins can
// edit everything, planners can edit their own divisions.

import { and, eq } from "drizzle-orm";
import { admins, conferenceUsers, divisions, plannerDivisions, type Db } from "@cp/db";

export type ConferenceRole = "admin" | "planner";

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function isSuperadmin(env: Env, email: string) {
  return (env.SUPERADMIN || "")
    .split(",")
    .map(normalizeEmail)
    .filter(Boolean)
    .includes(normalizeEmail(email));
}

/** Admins can create conferences */
export async function isAdmin(env: Env, db: Db, email: string) {
  if (isSuperadmin(env, email)) return true;
  const row = await db.query.admins.findFirst({ where: eq(admins.email, email) });
  return !!row;
}

/** The user's role in a conference. Superadmins act as conference admins */
export async function conferenceRole(
  env: Env,
  db: Db,
  email: string,
  conferenceId: number,
): Promise<ConferenceRole | null> {
  if (isSuperadmin(env, email)) return "admin";
  const row = await db.query.conferenceUsers.findFirst({
    where: and(
      eq(conferenceUsers.conferenceId, conferenceId),
      eq(conferenceUsers.email, email),
    ),
  });
  return row?.role ?? null;
}

export function canView(role: ConferenceRole | null) {
  return role !== null;
}

export function canEditConference(role: ConferenceRole | null) {
  return role === "admin";
}

/** Conference admins, and planners linked to the division */
export async function canEditDivision(
  env: Env,
  db: Db,
  email: string,
  divisionId: number,
) {
  const division = await db.query.divisions.findFirst({
    where: eq(divisions.id, divisionId),
  });
  if (!division) return false;
  const role = await conferenceRole(env, db, email, division.conferenceId);
  if (role === "admin") return true;
  if (role !== "planner") return false;
  const link = await db
    .select({ id: conferenceUsers.id })
    .from(plannerDivisions)
    .innerJoin(conferenceUsers, eq(conferenceUsers.id, plannerDivisions.conferenceUserId))
    .where(
      and(
        eq(plannerDivisions.divisionId, divisionId),
        eq(conferenceUsers.email, email),
        eq(conferenceUsers.conferenceId, division.conferenceId),
      ),
    )
    .limit(1);
  return link.length > 0;
}
