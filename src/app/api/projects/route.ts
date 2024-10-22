import { NextResponse } from "next/server";
import db, { projects, projectAdmins } from "@/drizzle/schema";
import { authenticate, isSuperAdmin } from "@/lib/authenticate";
import { eq } from "drizzle-orm";
import cryptoRandomString from "crypto-random-string";
import { NewProjectSchema } from "@/zodSchemas";

export async function GET(req: Request) {
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  if (isSuperAdmin(email)) {
    const projectList = await db.select().from(projects);
    return NextResponse.json(projectList);
  }

  const projectAdminList = await db
    .select()
    .from(projectAdmins)
    .where(eq(projectAdmins.email, email || ""))
    .leftJoin(projects, eq(projectAdmins.projectId, projects.id));

  const projectList = projectAdminList.map((p) => p.projects);
  return NextResponse.json(projectList);
}

export async function POST(req: Request) {
  const { email, canCreateProject } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });
  if (!canCreateProject) return NextResponse.json({}, { status: 403 });

  const body = await req.json();
  const newProject = NewProjectSchema.parse(body);

  try {
    const project = await db
      .insert(projects)
      .values({
        ...newProject,
        creator: email,
      })
      .returning();
    await db.insert(projectAdmins).values({
      projectId: project[0].id,
      email: email,
    });
    return NextResponse.json(project[0], { status: 201 });
  } catch (e) {
    return NextResponse.json({}, { status: 400 });
  }
}
