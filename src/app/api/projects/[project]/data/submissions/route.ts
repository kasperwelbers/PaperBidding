import db, {
  NewSubmission,
  NewAuthor,
  NewReviewer,
  submissions,
  reviewers,
  authors,
} from "@/drizzle/schema";
import {
  authenticate,
  authenticateReviewer,
  canEditProject,
} from "@/lib/authenticate";
import { SubmissionsSchema } from "@/zodSchemas";
import { createUserSecret } from "@/lib/createSecret";
import cryptoRandomString from "crypto-random-string";
import { sql, and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

export async function GET(req: Request, props: { params: Promise<{ project: number }> }) {
  const params = await props.params;
  const { email } = await authenticate();
  // if (!email)
  //   return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const canEdit = email ? await canEditProject(email, params.project) : false;
  const searchParams = new URL(req.url).searchParams;

  const offset = Number(searchParams.get("offset")) || 0;
  const limit = Number(searchParams.get("limit")) || 10;
  const reference = !!searchParams.get("reference");
  const metadata = !!searchParams.get("meta");

  if (!canEdit) {
    // reviewers can also GET submission, but not the reference submissions,
    // and not the meta
    const reviewer = await authenticateReviewer(req);
    if (!reviewer || reference || metadata)
      return NextResponse.json({ error: "not authorized" }, { status: 403 });
  }

  const fields: any = {
    id: submissions.id,
    title: submissions.title,
    features: submissions.features,
  };
  if (metadata) {
    fields.submissionId = submissions.submissionId;
    fields.authors = submissions.authors;
    fields.institutions = submissions.institutions;
  }

  const rowsPromise = db
    .select(fields)
    .from(submissions)
    .where(
      and(
        eq(submissions.isReference, reference),
        eq(submissions.projectId, params.project),
      ),
    )
    .orderBy(submissions.id)
    .offset(offset)
    .limit(limit);
  const metaPromise = db
    .select({ count: sql<number>`count(*)` })
    .from(submissions)
    .where(
      and(
        eq(submissions.isReference, reference),
        eq(submissions.projectId, params.project),
      ),
    );
  const [rows, meta] = await Promise.all([rowsPromise, metaPromise]);

  return NextResponse.json({ rows, meta: meta[0] });
}

export async function POST(req: Request, props: { params: Promise<{ project: number }> }) {
  const params = await props.params;
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit)
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });

  const { data } = await req.json();
  const searchParams = new URL(req.url).searchParams;
  const reference = !!searchParams.get("reference");

  const newSubmissions: NewSubmission[] = [];
  const newAuthors: NewAuthor[] = [];
  const newReviewers: NewReviewer[] = [];
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
      authors: row.authors,
      institutions: row.institutions,
      isReference: reference,
    });

    const addNewAuthors = row.authors.map((author, i) => ({
      projectId: params.project,
      submissionId: row.id,
      position: i,
      email: author,
      institution: row.institutions[i],
    }));
    for (let author of addNewAuthors) newAuthors.push(author);

    if (!reference) {
      const firstauthor = row.authors[0];
      const firstinstitution = row.institutions[0];
      newReviewers.push({
        projectId: params.project,
        email: firstauthor,
        institution: firstinstitution,
        importedFrom: "submission",
        secret: createUserSecret(params.project, firstauthor),
      });
    }
  }

  if (reference) {
    // if we are importing the reference, we don't want to overwrite existing submissions
    await db.insert(submissions).values(newSubmissions).onConflictDoNothing();
  } else {
    // but if we are importing submissions, we want to overwrite the reference. This way,
    // submissions will always be included as non-reference submissions
    await db
      .insert(submissions)
      .values(newSubmissions)
      .onConflictDoUpdate({
        target: [submissions.projectId, submissions.submissionId],
        set: { isReference: false },
      });
  }
  if (newAuthors.length > 0) await db.insert(authors).values(newAuthors);
  if (newReviewers.length > 0)
    await db.insert(reviewers).values(newReviewers).onConflictDoNothing();
  return NextResponse.json({ status: 201 });
}

export async function DELETE(req: Request, props: { params: Promise<{ project: number }> }) {
  const params = await props.params;
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit)
    return NextResponse.json({}, { statusText: "Not authorized", status: 403 });

  const searchParams = new URL(req.url).searchParams;
  const reference = !!searchParams.get("reference");

  await db
    .delete(submissions)
    .where(
      and(
        eq(submissions.projectId, params.project),
        eq(submissions.isReference, reference),
      ),
    );

  if (!reference) {
    await db
      .delete(reviewers)
      .where(
        and(
          eq(reviewers.projectId, params.project),
          eq(reviewers.importedFrom, "submission"),
        ),
      );
  }

  return NextResponse.json({}, { status: 201 });
}
