import db, { submissions, projects, reviewers, biddings } from '@/drizzle/schema';
import { authenticateReviewer } from '@/lib/authenticate';
import { BidsSchema } from '@/zodSchemas';

import { eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export async function GET(
  req: Request,
  { params }: { params: { project: number; reviewer: number } }
) {
  const reviewerId = Number(params.reviewer);
  const { reviewer, error } = await authenticateReviewer(req, reviewerId);
  if (error) return error;

  const bids = await db
    .select(biddings.submissionId)
    .from(biddings)
    .where(eq(biddings.reviewerId, reviewer.id))
    .orderBy(biddings.id);
  return NextResponse.json({ bids: bids });
}

export async function POST(
  req: Request,
  { params }: { params: { project: number; reviewer: number; submission: number } }
) {
  try {
    const reviewerId = Number(params.reviewer);
    const submissionId = Number(params.submission);

    const { reviewer, error } = await authenticateReviewer(req, reviewerId);
    if (error) return error;

    const { data } = await req.json();
    const validData = BidsSchema.safeParse(data);
    if (!validData.success) {
      return NextResponse.json(validData, {
        statusText: 'Invalid payload',
        status: 400
      });
    }

    if (validData.data.delete) {
      await db
        .delete(biddings)
        .where(
          eq(biddings.reviewerId, reviewerId),
          eq(biddings.submissionId, validData.data.submission)
        );
    } else {
      await db.insert(biddings).set({ reviewerId, submissionId: validData.data.submission });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ success: false });
  }
}
