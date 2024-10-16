import { assignments, biddings } from "@/drizzle/schema";
import { authenticate, canEditProject } from "@/lib/authenticate";
import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { project: number } },
) {
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit)
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });

  const aQuery = db
    .select({
      byReviewer: assignments.byReviewer,
      bySubmission: assignments.bySubmission,
      updated: assignments.updated,
    })
    .from(assignments)
    .where(eq(assignments.projectId, params.project));

  const lastBidQuery = db
    .select({ updated: biddings.updated })
    .from(biddings)
    .where(eq(biddings.projectId, params.project))
    .orderBy(desc(biddings.updated))
    .limit(1);

  const [a, lastBid] = await Promise.all([aQuery, lastBidQuery]);

  const res = {
    byReviewer: a[0].byReviewer,
    bySubmission: a[0].bySubmission,
    lastUpdate: a[0].updated,
    lastBid: lastBid[0]?.updated,
  };
  return NextResponse.json(res);
}

export async function POST(
  req: Request,
  { params }: { params: { project: number } },
) {
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit)
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });

  const { byReviewer, bySubmission } = await req.json();
  await db
    .insert(assignments)
    .values({
      projectId: params.project,
      byReviewer,
      bySubmission,
      updated: new Date(),
    })
    .onConflictDoUpdate({
      target: [assignments.projectId],
      set: { byReviewer, bySubmission, updated: new Date() },
    });

  return NextResponse.json({}, { status: 201 });
}
