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

  const rowsPromise = db
    .selectDistinctOn([reviewers.email], {
      id: reviewers.id,
      email: reviewers.email,
      institution: reviewers.institution,
      link: reviewers.secret,
      invitationSent: reviewers.invitationSent,
      biddings: biddings.submissionIds,
      importedFrom: reviewers.importedFrom,
      submission: {
        id: submissions.id,
        submissionId: submissions.submissionId,
        features: submissions.features,
        authors: submissions.authors,
      },
    })
    .from(reviewers)
    .where(and(eq(reviewers.projectId, params.project)))
    .orderBy(reviewers.email)
    .offset(offset)
    .limit(limit)
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
    .where(and(eq(reviewers.projectId, params.project)));
  const [rowResults, meta] = await Promise.all([rowsPromise, metaPromise]);

  const rows: Record<string, GetReviewer> = {};
  const domain = new URL(req.url).origin;
  for (let row of rowResults) {
    if (!rows[row.id]) {
      rows[row.email] = {
        id: row.id,
        email: row.email,
        institution: row.institution,
        link: domain + `/bidding/${params.project}/${row.id}/${row.link}`,
        invitationSent: row.invitationSent,
        biddings: row.biddings || [],
        manualBiddings: row.biddings?.length || 0,
        volunteer: row.importedFrom === "volunteer",
        coAuthors: [],
        submissions: [],
      };
    }
    if (row.submission) {
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
