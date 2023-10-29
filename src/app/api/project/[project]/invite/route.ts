import { authenticate, canEditProject } from '@/lib/authenticate';

import { NextResponse } from 'next/server';

export async function POST(req: Request, { params }: { params: { project: number } }) {
  const { email } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit) return NextResponse.json({}, { statusText: 'Not authorized', status: 403 });

  return NextResponse.json(params.project);
}
