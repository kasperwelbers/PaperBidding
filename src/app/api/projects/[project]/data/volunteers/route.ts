import db, {
  projects,
  reviewers,
  NewReviewer,
  submissions,
  authors,
  biddings,
} from "@/drizzle/schema";
import { authenticate, canEditProject } from "@/lib/authenticate";
import { createUserSecret } from "@/lib/createUserSecret";
import { GetReviewer, GetVolunteer } from "@/types";
import { ReviewersSchema } from "@/zodSchemas";
import { and, sql, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

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

  const searchParams = new URL(req.url).searchParams;
  const offset = Number(searchParams.get("offset")) || 0;
  const limit = Number(searchParams.get("limit")) || 10;

  const rowsPromise = db
    .selectDistinctOn([reviewers.email], {
      id: reviewers.id,
      email: reviewers.email,
    })
    .from(reviewers)
    .where(
      and(
        eq(reviewers.projectId, params.project),
        eq(reviewers.importedFrom, "volunteer"),
      ),
    )
    .orderBy(reviewers.email)
    .offset(offset)
    .limit(limit);

  const metaPromise = db
    .select({ count: sql<number>`count(distinct email)` })
    .from(reviewers)
    .where(
      and(
        eq(reviewers.projectId, params.project),
        eq(reviewers.importedFrom, "volunteer"),
      ),
    );
  const [rowResults, meta] = await Promise.all([rowsPromise, metaPromise]);

  const rows: Record<string, GetVolunteer> = {};
  for (let row of rowResults) {
    if (!rows[row.id]) {
      rows[row.email] = {
        id: row.id,
        email: row.email,
      };
    }
  }

  return NextResponse.json({ rows: Object.values(rows), meta: meta[0] });
}

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

  const { data } = await req.json();

  const validData = ReviewersSchema.safeParse(data);
  if (!validData.success)
    return NextResponse.json(validData.error, {
      statusText: "invalid payload",
      status: 400,
    });

  const currentVolunteers = (
    await db
      .select({ email: reviewers.email })
      .from(reviewers)
      .where(
        and(
          eq(reviewers.projectId, params.project),
          eq(reviewers.importedFrom, "volunteer"),
        ),
      )
  ).map((r) => r.email);
  const deleteReviewers = new Set(currentVolunteers);

  const newReviewers: NewReviewer[] = [];
  for (let d of validData.data) {
    if (currentVolunteers.includes(d.email)) {
      deleteReviewers.delete(d.email);
    } else {
      newReviewers.push({
        email: d.email,
        projectId: params.project,
        importedFrom: "volunteer",
        secret: createUserSecret(params.project, d.email),
      });
    }
  }

  await db.transaction(async (tx) => {
    if (newReviewers.length > 0)
      await tx.insert(reviewers).values(newReviewers);
    if (deleteReviewers.size)
      await tx
        .delete(reviewers)
        .where(
          and(
            eq(reviewers.projectId, params.project),
            inArray(reviewers.email, Array.from(deleteReviewers)),
          ),
        );
  });
  return NextResponse.json({ status: 201 });
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

  await db
    .delete(reviewers)
    .where(
      and(
        eq(reviewers.projectId, params.project),
        eq(reviewers.importedFrom, "volunteer"),
      ),
    );
  return NextResponse.json({}, { status: 201 });
}
