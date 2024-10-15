import db, { projectAdmins, projects } from "@/drizzle/schema";
import { authenticate, canEditProject } from "@/lib/authenticate";
import { and, eq } from "drizzle-orm";

import { NextResponse } from "next/server";
import { z } from "zod";

const EmailSchema = z.object({ email: z.string().email() });

export async function POST(
  req: Request,
  { params }: { params: { project: number } },
) {
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit)
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });

  const { email: admin } = EmailSchema.parse(await req.json());
  await db
    .insert(projectAdmins)
    .values({ projectId: params.project, email: admin });

  return NextResponse.json({}, { status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: { project: number } },
) {
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit)
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });

  const { email: admin } = EmailSchema.parse(await req.json());

  await db
    .delete(projectAdmins)
    .where(
      and(
        eq(projectAdmins.projectId, params.project),
        eq(projectAdmins.email, admin),
        eq(projectAdmins.isCreator, false),
      ),
    );

  return NextResponse.json({}, { status: 201 });
}
