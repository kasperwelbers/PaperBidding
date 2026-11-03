import db, { submissions } from "@/drizzle/schema";
import { authenticate, canEditProject } from "@/lib/authenticate";
import { referencePoolProjectId } from "@/lib/referencePool";
import { eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";

/** Whether the central ICA reference project is set, and how many submissions
 *  it has. Its submissions are used automatically as reference submissions */
export async function GET(
  req: Request,
  props: { params: Promise<{ project: string }> },
) {
  const projectId = Number((await props.params).project);
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });
  const canEdit = await canEditProject(email, projectId);
  if (!canEdit)
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });

  const poolId = referencePoolProjectId();
  if (!poolId || poolId === projectId)
    return NextResponse.json({ available: false, total: 0 });

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(submissions)
    .where(eq(submissions.projectId, poolId));

  return NextResponse.json({ available: total > 0, total });
}
