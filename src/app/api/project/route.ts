import { NextResponse } from 'next/server';
import cryptoRandomString from 'crypto-random-string';
import db, { projects } from '@/drizzle/schema';
import { authenticateAdmin } from '@/lib/authenticate';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth/authOptions';

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);

  if (!session?.user.email) return NextResponse.json({}, { status: 401 });

  console.log(session);
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
        readToken: cryptoRandomString({ length: 32, type: 'url-safe' }),
        editToken: cryptoRandomString({ length: 32, type: 'url-safe' })
      })
      .returning();
    return NextResponse.json(newProject[0], { status: 201 });
  } catch (e) {
    return NextResponse.json({}, { status: 400 });
  }
}
