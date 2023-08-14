import { authenticateProject } from '@/lib/authenticate';

import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { project: number } }) {
  const project = await authenticateProject(req, params.project, true);
  return NextResponse.json(project);
}
