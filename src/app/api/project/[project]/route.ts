import { authenticateProject } from '@/lib/authenticate';

import { NextResponse } from 'next/server';

export async function GET(req: Request, { params }: { params: { project: number } }) {
  const searchParams = new URL(req.url).searchParams;
  const edit = !!searchParams.get('edit');

  const { project, error } = await authenticateProject(req, params.project, edit);
  if (error) return error;

  return NextResponse.json(project);
}
