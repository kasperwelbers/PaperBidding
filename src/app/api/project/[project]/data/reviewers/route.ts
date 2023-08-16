import db, { reviewers, NewReviewer } from "@/drizzle/schema";
import { authenticateProject } from "@/lib/authenticate";
import { ReviewersSchema } from "@/zodSchemas";
import cryptoRandomString from "crypto-random-string";
import { and, sql, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { project: number } }
) {
  await authenticateProject(req, params.project, true);
  const searchParams = new URL(req.url).searchParams;
  const offset = Number(searchParams.get("offset")) || 0;
  const limit = Number(searchParams.get("limit")) || 10;
  const importedFrom = getImportedFrom(searchParams);

  const rowsPromise = db
    .selectDistinctOn([reviewers.email], {
      email: reviewers.email,
      link: reviewers.token,
    })
    .from(reviewers)
    .where(
      and(
        eq(reviewers.projectId, params.project),
        inArray(reviewers.importedFrom, importedFrom)
      )
    )
    .offset(offset)
    .limit(limit);
  const metaPromise = db
    .select({ count: sql<number>`count(distinct email)` })
    .from(reviewers)
    .where(
      and(
        eq(reviewers.projectId, params.project),
        inArray(reviewers.importedFrom, importedFrom)
      )
    );

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
  const searchParams = new URL(req.url).searchParams;
  const volunteer = !!searchParams.get("volunteer") ? "volunteer" : null;
  const submission = !!searchParams.get("submission") ? "submission" : null;
  const reference = !!searchParams.get("reference") ? "reference" : null;

  const validData = ReviewersSchema.safeParse(data);
  if (!validData.success)
    return NextResponse.json(validData.error, {
      statusText: "invalid payload",
      status: 400,
    });

  const newReviewers: NewReviewer[] = validData.data.map((d: any) => ({
    email: d.email,
    projectId: params.project,
    importedFrom: volunteer || submission || reference || "volunteer",
    token: cryptoRandomString({ length: 32, type: "url-safe" }),
  }));
  await db.insert(reviewers).values(newReviewers);
  return NextResponse.json({ status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: { project: number } }
) {
  await authenticateProject(req, params.project, true);
  const searchParams = new URL(req.url).searchParams;
  const importedFrom = getImportedFrom(searchParams);

  await db
    .delete(reviewers)
    .where(
      and(
        eq(reviewers.projectId, params.project),
        inArray(reviewers.importedFrom, importedFrom)
      )
    );
  return NextResponse.json({}, { status: 201 });
}

function getImportedFrom(searchParams: URLSearchParams) {
  // In GET and DELETE
  // reviewers endpoint can have parameters volunteer, submission, reference.
  // these are used to filter reviewers on the basis of their importedFrom field.
  // If none of them are present, then all three are assumed.
  const volunteer = !!searchParams.get("volunteer");
  const submission = !!searchParams.get("submission");
  const reference = !!searchParams.get("reference");
  const importedFrom = [];
  if (!volunteer && !submission && !reference) {
    importedFrom.push("volunteer", "submission", "reference");
  } else {
    if (volunteer) importedFrom.push("volunteer");
    if (submission) importedFrom.push("submission");
    if (reference) importedFrom.push("reference");
  }
  return importedFrom;
}
