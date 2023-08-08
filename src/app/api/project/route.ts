import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import cryptoRandomString from 'crypto-random-string';
import db, { project } from '@/drizzle/schema';

export async function GET(req: Request) {
  const headersList = headers();
  const token = headersList.get('Authorization');
  if (token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({}, { statusText: 'Invalid Token', status: 403 });
  }

  const projects = await db.select().from(project);
  return NextResponse.json(projects);
}

export async function POST(req: Request) {
  const { name } = await req.json();

  try {
    const newProject = await db
      .insert(project)
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
