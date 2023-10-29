import { NextResponse } from 'next/server';
import db, { projects, projectAdmins } from '@/drizzle/schema';
import { authenticate, isSuperAdmin } from '@/lib/authenticate';
import { eq } from 'drizzle-orm';
import cryptoRandomString from 'crypto-random-string';

export async function GET(req: Request) {
  const { email } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });

  if (isSuperAdmin(email)) {
    const projectList = await db.select().from(projects);
    return NextResponse.json(projectList);
  }

  const projectList = await db
    .select(projects)
    .from(projectAdmins)
    .where(eq(projectAdmins.email, email || ''))
    .leftJoin(projects, eq(projectAdmins.projectId, projects.id));

  return NextResponse.json(projectList);
}

export async function POST(req: Request) {
  const { email, canCreateProject } = await authenticate();
  if (!email) return NextResponse.json({}, { statusText: 'Not signed in', status: 403 });
  if (!canCreateProject) return NextResponse.json({}, { status: 403 });

  const { name } = await req.json();

  try {
    const newProject = await db
      .insert(projects)
      .values({
        name: name,
        creator: email,
        readToken: cryptoRandomString({ length: 32, type: 'url-safe' })
      })
      .returning();
    await db.insert(projectAdmins).values({
      projectId: newProject[0].id,
      email: email
    });
    return NextResponse.json(newProject[0], { status: 201 });
  } catch (e) {
    return NextResponse.json({}, { status: 400 });
  }
}
