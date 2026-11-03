import db, { projects, reviewers } from "@/drizzle/schema";
import { authenticate, canEditProject } from "@/lib/authenticate";
import { createUserSecret } from "@/lib/createSecret";
import { JoinProjectSchema } from "@/zodSchemas";
import { and, asc, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { defaultRegistrationUrl } from "@/lib/registrationUrl";

async function getJoinableProject(projectId: number, token: string | null) {
  if (!projectId || !token) return undefined;
  const [project] = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.joinToken, token)));
  if (!project || project.archived) return undefined;
  return project;
}

async function findReviewer(projectId: number, email: string) {
  const [reviewer] = await db
    .select({ id: reviewers.id, secret: reviewers.secret })
    .from(reviewers)
    .where(
      and(
        eq(reviewers.projectId, projectId),
        eq(sql`lower(${reviewers.email})`, email.toLowerCase()),
      ),
    )
    .orderBy(asc(reviewers.id))
    .limit(1);
  return reviewer;
}

/** Public info about the project behind a join link, and if signed in, whether
 *  the user is a known reviewer (in which case we return their bidding credentials) */
export async function GET(
  req: Request,
  props: { params: Promise<{ project: string }> },
) {
  const params = await props.params;
  const projectId = Number(params.project);
  const token = new URL(req.url).searchParams.get("token");

  const project = await getJoinableProject(projectId, token);
  if (!project)
    return NextResponse.json({}, { statusText: "Invalid link", status: 404 });

  const { email } = await authenticate();
  const reviewer = email ? await findReviewer(projectId, email) : undefined;

  return NextResponse.json({
    project: {
      id: project.id,
      name: project.name,
      division: project.division,
      deadline: project.deadline,
      registrationInfoUrl:
        project.registrationInfoUrl || defaultRegistrationUrl(project.created),
    },
    email: email || null,
    reviewer: reviewer
      ? { reviewerId: reviewer.id, secret: reviewer.secret }
      : null,
  });
}

/** Register the signed in user as a (self-registered) volunteer reviewer */
export async function POST(
  req: Request,
  props: { params: Promise<{ project: string }> },
) {
  const params = await props.params;
  const projectId = Number(params.project);
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const body = JoinProjectSchema.safeParse(await req.json());
  if (!body.success)
    return NextResponse.json(
      {},
      { statusText: "Invalid payload", status: 400 },
    );

  const project = await getJoinableProject(projectId, body.data.token);
  if (!project)
    return NextResponse.json({}, { statusText: "Invalid link", status: 404 });

  let reviewer = await findReviewer(projectId, email);
  if (!reviewer) {
    const reviewerEmail = email.toLowerCase();
    await db
      .insert(reviewers)
      .values({
        projectId,
        email: reviewerEmail,
        institution: "",
        student: body.data.student,
        canReview: true,
        importedFrom: "volunteer",
        selfRegistered: true,
        secret: createUserSecret(projectId, reviewerEmail),
      })
      .onConflictDoNothing();
    reviewer = await findReviewer(projectId, email);
  }
  if (!reviewer)
    return NextResponse.json({}, { statusText: "Could not join", status: 500 });

  return NextResponse.json(
    { reviewerId: reviewer.id, secret: reviewer.secret },
    { status: 201 },
  );
}

/** Regenerate the join token (invalidates the old general invitation link) */
export async function PUT(
  req: Request,
  props: { params: Promise<{ project: string }> },
) {
  const params = await props.params;
  const projectId = Number(params.project);
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const canEdit = await canEditProject(email, projectId);
  if (!canEdit)
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });

  const joinToken = randomBytes(16).toString("hex");
  await db
    .update(projects)
    .set({ joinToken })
    .where(eq(projects.id, projectId));
  return NextResponse.json({ joinToken }, { status: 201 });
}
