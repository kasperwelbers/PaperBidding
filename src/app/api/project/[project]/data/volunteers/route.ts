import db, { volunteers, NewVolunteer } from "@/drizzle/schema";
import { authenticateProject } from "@/lib/authenticate";
import { VolunteersSchema } from "@/zodSchemas";
import cryptoRandomString from "crypto-random-string";
import { sql, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { project: number } }
) {
  await authenticateProject(req, params.project, true);
  const searchParams = new URL(req.url).searchParams;
  const offset = Number(searchParams.get("offset")) || 0;
  const limit = Number(searchParams.get("limit")) || 10;

  const rowsPromise = db
    .select({ email: volunteers.email, link: volunteers.token })
    .from(volunteers)
    .where(eq(volunteers.projectId, params.project))
    .offset(offset)
    .limit(limit);
  const metaPromise = db
    .select({ count: sql<number>`count(*)` })
    .from(volunteers)
    .where(eq(volunteers.projectId, params.project));
  const [rows, meta] = await Promise.all([rowsPromise, metaPromise]);
  for (let row of rows)
    row.link = `/project/${params.project}/bid?token=${row.link}`;
  return NextResponse.json({ rows, meta: meta[0] });
}

export async function POST(
  req: Request,
  { params }: { params: { project: number } }
) {
  await authenticateProject(req, params.project, true);
  const { data } = await req.json();
  const validData = VolunteersSchema.safeParse(data);
  if (!validData.success)
    return NextResponse.json(validData.error, {
      statusText: "invalid payload",
      status: 400,
    });

  const newVolunteers: NewVolunteer[] = validData.data.map((d: any) => ({
    email: d.email,
    projectId: params.project,
    token: cryptoRandomString({ length: 32, type: "url-safe" }),
  }));
  await db.insert(volunteers).values(newVolunteers);
  return NextResponse.json({ status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: { project: number } }
) {
  await authenticateProject(req, params.project, true);
  const searchParams = new URL(req.url).searchParams;
  const reference = !!searchParams.get("reference");

  await db.delete(volunteers).where(eq(volunteers.projectId, params.project));
  return NextResponse.json({}, { status: 204 });
}
