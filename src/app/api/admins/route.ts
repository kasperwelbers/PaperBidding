import db, { admins, projectAdmins, projects } from "@/drizzle/schema";
import { authenticate, canEditProject } from "@/lib/authenticate";
import { eq } from "drizzle-orm";
import { GetProject } from "@/types";

import { NextResponse } from "next/server";
import { NewProjectSchema } from "@/zodSchemas";
import { z } from "zod";

export async function GET(
  req: Request,
  { params }: { params: { project: number } },
) {
  const { email, isSuperAdmin } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });
  if (!isSuperAdmin) {
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });
  }

  const ads = await db.select().from(admins);
  return NextResponse.json(ads);
}

export async function POST(
  req: Request,
  { params }: { params: { project: number } },
) {
  const { email, isSuperAdmin } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });
  if (!isSuperAdmin) {
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });
  }

  const body = await req.json();
  const schema = z.array(z.object({ email: z.string().email() }));
  const emails = schema.parse(body);

  try {
    const project = await db
      .insert(admins)
      .values(emails)
      .onConflictDoNothing();
    return NextResponse.json({}, { status: 201 });
  } catch (e) {
    return NextResponse.json({}, { status: 400 });
  }
}
