import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import cryptoRandomString from 'crypto-random-string';
import db, { projects } from '@/drizzle/schema';
import { authenticateAdmin } from '@/lib/authenticate';

export async function GET(req: Request) {
  authenticateAdmin(req);

  const projectList = await db.select().from(projects);
  return NextResponse.json(projectList);
}

export async function POST(req: Request) {
  authenticateAdmin(req);

  const { name } = await req.json();

  try {
    const newProject = await db
      .insert(projects)
      .values({
        name: name,
        token: cryptoRandomString({ length: 32 })
      })
      .returning();
    return NextResponse.json(newProject[0], { status: 201 });
  } catch (e) {
    return NextResponse.json({}, { status: 400 });
  }
}
