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
import { ReviewersSchema } from "@/zodSchemas";
import cryptoRandomString from "crypto-random-string";
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

  // first look up the distinct reviewers, so that the limit applies to reviewers and not the joins
  const sq = db
    .selectDistinctOn([reviewers.email], {
      id: reviewers.id,
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
    .limit(limit)
    .as("subquery");

  const rowsPromise = db
    .selectDistinctOn([reviewers.email], {
      id: reviewers.id,
      email: reviewers.email,
      institution: reviewers.institution,
      student: reviewers.student,
      canReview: reviewers.canReview,
      link: reviewers.secret,
      invitationSent: reviewers.invitationSent,
      biddings: biddings.submissionIds,
      importedFrom: reviewers.importedFrom,
      author: {
        position: authors.position,
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
        eq(authors.projectId, reviewers.projectId),
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
        eq(reviewers.projectId, params.project),
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
        firstAuthor: false,
        link: domain + `/bidding/${params.project}/${row.id}/${row.link}`,
        invitationSent: row.invitationSent,
        biddings: row.biddings || [],
        manualBiddings: row.biddings?.length || 0,
        volunteer: row.importedFrom === "volunteer",
        coAuthors: [],
        submissions: [],
      };
    }
    if (row.author) {
      if (row.author.position === 0) rows[row.email].firstAuthor = true;
    }
    if (row.submission && !row.submission.isReference) {
      rows[row.email].submissions.push({
        id: row.submission.id,
        submissionId: row.submission.submissionId,
        features: row.submission.features,
      });

      for (let author of row.submission.authors) {
        if (!rows[row.email].coAuthors.includes(author)) {
          rows[row.email].coAuthors.push(author);
        }
      }
    }
  }

  return NextResponse.json({ rows: Object.values(rows), meta: meta[0] });
}
