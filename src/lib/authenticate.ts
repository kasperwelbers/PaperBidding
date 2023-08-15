import { NextResponse } from "next/server";
import db, { projects } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

export function authenticateAdmin(req: Request) {
  const token = req.headers.get("Authorization");
  if (token !== process.env.ADMIN_TOKEN) {
    return NextResponse.json({}, { statusText: "Invalid Token", status: 403 });
  }
}

export async function authenticateProject(
  req: Request,
  projectId: number,
  edit: boolean
) {
  const token = req.headers.get("Authorization");
  const project = await db
    .select()
    .from(projects)
    .where(eq(projects.id, projectId));
  const p = project[0];
  let editRight = false;

  if (p === undefined)
    NextResponse.json({}, { statusText: "Invalid Project", status: 404 });

  if (edit) {
    if (token !== p.editToken) {
      NextResponse.json({}, { statusText: "Invalid Token", status: 403 });
    }
    editRight = true;
  } else {
    if (token !== p.readToken || token !== p.editToken) {
      NextResponse.json({}, { statusText: "Invalid Token", status: 403 });
    }
    if (token === p.editToken) {
      editRight = true;
    }
  }

  return { project: p, editRight };
}
