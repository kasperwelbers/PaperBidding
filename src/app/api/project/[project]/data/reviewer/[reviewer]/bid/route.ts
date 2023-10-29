import db, { reviewers } from '@/drizzle/schema';
import { authenticateReviewer } from '@/lib/authenticate';
import { BidsSchema } from '@/zodSchemas';

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { project: number } }) {
  const reviewer = await authenticateReviewer(req);
  if (!reviewer) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });
  return NextResponse.json({ selection: reviewer.biddings });
}

export async function POST(
  req: Request,
  { params }: { params: { project: number; reviewer: number; submission: number } }
) {
  try {
    const rev = await authenticateReviewer(req);
    if (!rev) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });
    const { selected } = await req.json();
    await db.update(reviewers).set({ biddings: selected }).where(eq(reviewers.id, rev.id));

    return NextResponse.json({}, { status: 201 });
  } catch (e) {
    console.log(e);
    return NextResponse.json({}, { statusText: 'Could not post selection', status: 403 });
  }
}
