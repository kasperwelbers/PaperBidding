import db, {
  NewSubmission,
  NewAuthor,
  submissions,
  authors,
} from "@/drizzle/schema";
import { authenticateProject } from "@/lib/authenticate";
import { SubmissionsSchema } from "@/schemas";
import cryptoRandomString from "crypto-random-string";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(
  req: Request,
  { params }: { params: { project: number } }
) {
  const { editRight } = await authenticateProject(req, params.project, false);
  const searchParams = new URL(req.url).searchParams;
  const offset = Number(searchParams.get("offset")) || 0;
  const limit = Number(searchParams.get("limit")) || 10;
  const reference = !!searchParams.get("reference");

  if (!editRight && reference) {
    // project read token can only be used to get the normal submissions
    return NextResponse.json(
      { error: "not authorized" },
      { status: 403, statusText: "not authorized" }
    );
  }

  const data = await db
    .select()
    .from(submissions)
    .where(
      and(
        eq(submissions.isReference, reference),
        eq(submissions.projectId, params.project)
      )
    )
    .offset(offset)
    .limit(limit);
  return NextResponse.json(data);
}

export async function POST(
  req: Request,
  { params }: { params: { project: number } }
) {
  await authenticateProject(req, params.project, true);
  const { data } = await req.json();
  const searchParams = new URL(req.url).searchParams;
  const reference = !!searchParams.get("reference");

  const newSubmissions: NewSubmission[] = [];
  const newAuthors: NewAuthor[] = [];
  const validData = SubmissionsSchema.safeParse(data);
  if (!validData.success)
    return NextResponse.json(validData, {
      statusText: "Invalid payload",
      status: 400,
    });

  for (let row of validData.data) {
    newSubmissions.push({
      projectId: params.project,
      submissionId: row.id,
      title: row.title,
      abstract: row.abstract,
      features: row.features,
      isReference: reference,
    });

    for (let author of row.authors) {
      newAuthors.push({
        projectId: params.project,
        submissionId: row.id,
        email: author,
        token: cryptoRandomString({ length: 32, type: "url-safe" }),
      });
    }
  }

  await db.insert(submissions).values(newSubmissions);
  await db.insert(authors).values(newAuthors);
  return NextResponse.json({ status: 201 });
}

export async function DELETE(
  req: Request,
  { params }: { params: { project: number } }
) {
  await authenticateProject(req, params.project, true);
  const searchParams = new URL(req.url).searchParams;
  const reference = !!searchParams.get("reference");

  await db
    .delete(submissions)
    .where(
      and(
        eq(submissions.projectId, params.project),
        eq(submissions.isReference, reference)
      )
    );
  return NextResponse.json({}, { status: 204 });
}
