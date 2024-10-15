import db, { projectAdmins, projects } from "@/drizzle/schema";
import { authenticate, canEditProject } from "@/lib/authenticate";
import { eq } from "drizzle-orm";
import { GetProject } from "@/types";

import { NextResponse } from "next/server";
import { NewProjectSchema } from "@/zodSchemas";

export async function GET(
  req: Request,
  { params }: { params: { project: number } },
) {
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit)
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });

  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, params.project))
    .leftJoin(projectAdmins, eq(projectAdmins.projectId, projects.id));
  const p: any = project[0].projects;
  if (!p)
    return NextResponse.json({}, { statusText: "Not found", status: 404 });

  p.admins = project.map((p: any) => p.project_admins.email);

  return NextResponse.json(p);
}

export async function POST(
  req: Request,
  { params }: { params: { project: number } },
) {
  const { email, canCreateProject } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });
  if (!canCreateProject) return NextResponse.json({}, { status: 403 });

  const body = await req.json();
  const newProject = NewProjectSchema.parse(body);

  try {
    const project = await db
      .update(projects)
      .set({
        ...newProject,
        creator: email,
      })
      .where(eq(projects.id, params.project));
    return NextResponse.json({}, { status: 201 });
  } catch (e) {
    return NextResponse.json({}, { status: 400 });
  }
}
