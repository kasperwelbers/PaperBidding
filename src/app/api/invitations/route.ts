import db, { projectAdmins, projects, reviewers } from '@/drizzle/schema';
import { authenticate, canEditProject } from '@/lib/authenticate';
import { eq } from 'drizzle-orm';
import { GetInvitation } from '@/types';

import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { email } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });

  const invitations = await db
    .select({
      projectId: reviewers.projectId,
      label: projects.name,
      reviewerId: reviewers.id,
      secret: reviewers.secret
    })
    .from(reviewers)
    .where(eq(reviewers.email, email || ''))
    .leftJoin(projects, eq(projects.id, reviewers.projectId));

  const domain = new URL(req.url).origin;

  const json = invitations.map((i: any) => {
    return {
      label: i.label,
      link: domain + `/bidding/${i.projectId}/${i.reviewerId}/${i.secret}`
    };
  });

  return NextResponse.json(json, { status: 200 });
}
