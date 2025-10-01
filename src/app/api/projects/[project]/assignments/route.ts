import db, { assignments, biddings } from "@/drizzle/schema";
import { authenticate, canEditProject } from "@/lib/authenticate";
import { AssignmentsSchema } from "@/zodSchemas";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

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

  const aQuery = db
    .select({
      byReviewer: assignments.byReviewer,
      bySubmission: assignments.bySubmission,
      settings: assignments.settings,
      updated: assignments.updated,
    })
    .from(assignments)
    .where(eq(assignments.projectId, projectId));

  const lastBidQuery = db
    .select({ updated: biddings.updated })
    .from(biddings)
    .where(eq(biddings.projectId, projectId))
    .orderBy(desc(biddings.updated))
    .limit(1);

  const [a, lastBid] = await Promise.all([aQuery, lastBidQuery]);

  const res = {
    byReviewer: a[0].byReviewer,
    bySubmission: a[0].bySubmission,
    settings: a[0].settings,
    lastUpdate: a[0].updated,
    lastBid: lastBid[0]?.updated,
  };
  return NextResponse.json(res);
}

export async function POST(
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

  const { byReviewer, bySubmission, settings } = AssignmentsSchema.parse(
    await req.json(),
  );
  await db
    .insert(assignments)
    .values({
      projectId: projectId,
      byReviewer,
      bySubmission,
      settings,
      updated: new Date(),
    })
    .onConflictDoUpdate({
      target: [assignments.projectId],
      set: { byReviewer, bySubmission, settings, updated: new Date() },
    });

  return NextResponse.json({}, { status: 201 });
}
