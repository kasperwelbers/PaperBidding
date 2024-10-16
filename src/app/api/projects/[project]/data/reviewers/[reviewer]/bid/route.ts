import db, { biddings, reviewers } from "@/drizzle/schema";
import { authenticateReviewer } from "@/lib/authenticate";
import { BidsSchema } from "@/zodSchemas";

import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { project: number } },
) {
  const reviewer = await authenticateReviewer(req);
  if (!reviewer)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  return NextResponse.json({ selection: reviewer.biddings });
}

export async function POST(
  req: Request,
  {
    params,
  }: { params: { project: number; reviewer: number; submission: number } },
) {
  try {
    const rev = await authenticateReviewer(req);
    if (!rev)
      return NextResponse.json(
        {},
        { statusText: "Not signed in", status: 403 },
      );
    const { selected } = await req.json();

    await db
      .insert(biddings)
      .values({
        projectId: params.project,
        email: rev.email,
        submissionIds: selected,
        updated: new Date(),
      })
      .onConflictDoUpdate({
        target: [biddings.projectId, biddings.email],
        set: { submissionIds: selected },
      });

    return NextResponse.json({}, { status: 201 });
  } catch (e) {
    console.log(e);
    return NextResponse.json(
      {},
      { statusText: "Could not post selection", status: 403 },
    );
  }
}
