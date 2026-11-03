import db, {
  projects,
  reviewers,
  NewReviewer,
  submissions,
  authors,
  biddings,
} from "@/drizzle/schema";
import { authenticate, canEditProject } from "@/lib/authenticate";
import { GetReviewer } from "@/types";
import { ReviewersSchema, UpdateReviewerSchema } from "@/zodSchemas";
import cryptoRandomString from "crypto-random-string";
import { and, sql, eq, inArray } from "drizzle-orm";
import { referencePoolProjectId } from "@/lib/referencePool";
import { NextResponse } from "next/server";

export async function GET(
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

  const searchParams = new URL(req.url).searchParams;
  const offset = Number(searchParams.get("offset")) || 0;
  const limit = Number(searchParams.get("limit")) || 10;

  // Submissions of the reviewer in the central reference project are used as
  // reference submissions (for similarity and co-authors), but not for authorship
  const poolId = referencePoolProjectId();
  const authorProjects =
    poolId && poolId !== projectId ? [projectId, poolId] : [projectId];

  // first look up the distinct reviewers, so that the limit applies to reviewers and not the joins
  const sq = db
    .selectDistinctOn([reviewers.email], {
      id: reviewers.id,
    })
    .from(reviewers)
    .where(
      and(
        eq(reviewers.projectId, projectId),
        eq(reviewers.importedFrom, "volunteer"),
      ),
    )
    .orderBy(reviewers.email)
    .offset(offset)
    .limit(limit)
    .as("subquery");

  const rowsPromise = db
    .select({
      id: reviewers.id,
      email: reviewers.email,
      institution: reviewers.institution,
      student: reviewers.student,
      canReview: reviewers.canReview,
      link: reviewers.secret,
      invitationSent: reviewers.invitationSent,
      biddings: biddings.submissionIds,
      importedFrom: reviewers.importedFrom,
      selfRegistered: reviewers.selfRegistered,
      author: {
        position: authors.position,
        projectId: authors.projectId,
      },
      submission: {
        id: submissions.id,
        submissionId: submissions.submissionId,
        features: submissions.features,
        authors: submissions.authors,
        isReference: submissions.isReference,
      },
    })
    .from(reviewers)
    .innerJoin(sq, eq(reviewers.id, sq.id))
    .leftJoin(
      authors,
      and(
        inArray(authors.projectId, authorProjects),
        eq(authors.email, reviewers.email),
      ),
    )
    .leftJoin(
      submissions,
      and(
        eq(submissions.projectId, authors.projectId),
        eq(submissions.submissionId, authors.submissionId),
      ),
    )
    .leftJoin(
      biddings,
      and(
        eq(biddings.projectId, reviewers.projectId),
        eq(biddings.email, reviewers.email),
      ),
    );

  const metaPromise = db
    .select({ count: sql<number>`count(distinct email)` })
    .from(reviewers)
    .where(
      and(
        eq(reviewers.projectId, projectId),
        eq(reviewers.importedFrom, "volunteer"),
      ),
    );
  const [rowResults, meta] = await Promise.all([rowsPromise, metaPromise]);

  const rows: Record<string, GetReviewer> = {};
  const domain = new URL(req.url).origin;
  for (let row of rowResults) {
    if (!rows[row.email]) {
      rows[row.email] = {
        id: row.id,
        email: row.email,
        institution: row.institution,
        student: row.student,
        canReview: row.canReview,
        author: false,
        firstAuthor: false,
        link: domain + `/bidding/${projectId}/${row.id}/${row.link}`,
        invitationSent: row.invitationSent ? String(row.invitationSent) : null,
        biddings: row.biddings || [],
        manualBiddings: row.biddings?.length || 0,
        volunteer: row.importedFrom === "volunteer",
        selfRegistered: row.selfRegistered,
        coAuthors: [],
        submissions: [],
      };
    }
    const fromPool = row.author?.projectId !== projectId;
    if (row.author && !fromPool) {
      if (row.author.position === 0) rows[row.email].firstAuthor = true;
    }
    if (row.submission) {
      const isReference = row.submission.isReference || fromPool;
      if (!isReference) {
        rows[row.email].author = true;
        if (row.author && row.author.position === 0)
          rows[row.email].firstAuthor = true;
      }

      // The same control ID can be in this project and in the reference
      // project. Use it once, and prefer this project's row (its id is used
      // to exclude own submissions)
      const own = rows[row.email].submissions;
      const i = own.findIndex(
        (s) => s.submissionId === row.submission!.submissionId,
      );
      const submission = {
        id: row.submission.id,
        submissionId: row.submission.submissionId,
        features: row.submission.features,
        isReference,
      };
      if (i === -1) own.push(submission);
      else if (!fromPool) own[i] = submission;

      for (let author of row.submission.authors) {
        if (!rows[row.email].coAuthors.includes(author)) {
          rows[row.email].coAuthors.push(author);
        }
      }
    }
  }

  return NextResponse.json({ rows: Object.values(rows), meta: meta[0] });
}

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

  const body = await req.json();
  const data = UpdateReviewerSchema.parse(body);

  await db
    .update(reviewers)
    .set(data)
    .where(
      and(eq(reviewers.projectId, projectId), eq(reviewers.email, data.email)),
    );

  return NextResponse.json({}, { status: 201 });
}
