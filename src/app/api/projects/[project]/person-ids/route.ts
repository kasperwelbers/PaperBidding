import db, { icaPersons, reviewers } from "@/drizzle/schema";
import { authenticate, canEditProject } from "@/lib/authenticate";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

/** ICA Person IDs for the reviewers of this project, as { [email]: personId }.
 *  Emails are lowercased. Only returns the project's own reviewers, so that the
 *  global list is never exposed in bulk */
export async function GET(
  req: Request,
  props: { params: Promise<{ project: string }> },
) {
  const params = await props.params;
  const projectId = Number(params.project);
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const canEdit = await canEditProject(email, projectId);
  if (!canEdit)
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });

  const rows = await db
    .selectDistinct({ email: icaPersons.email, personId: icaPersons.personId })
    .from(reviewers)
    .innerJoin(
      icaPersons,
      eq(icaPersons.email, sql`lower(trim(${reviewers.email}))`),
    )
    .where(eq(reviewers.projectId, projectId));

  const res: Record<string, string> = {};
  for (const row of rows) res[row.email] = row.personId;
  return NextResponse.json(res);
}
