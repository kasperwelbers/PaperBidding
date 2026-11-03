import db, { authors, submissions, Submission } from "@/drizzle/schema";
import { authenticateReviewer } from "@/lib/authenticate";

import { and, eq, inArray, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { referencePoolProjectId } from "@/lib/referencePool";

export async function GET(
  req: Request,
  props: { params: Promise<{ project: string; reviewer: string }> },
) {
  const params = await props.params;
  const projectId = Number(params.project);

  const reviewer = await authenticateReviewer(req);
  if (!reviewer)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  if (reviewer.projectId !== projectId)
    return NextResponse.json(
      {},
      { status: 404, statusText: `Invalid project ${projectId} reviewer` },
    );

  // The reviewer's submissions in the central reference project are also used
  // (for similarity and co-authors)
  const poolId = referencePoolProjectId();
  const authorProjects =
    poolId && poolId !== projectId ? [projectId, poolId] : [projectId];

  const submissionRows = await db
    .select({
      id: submissions.id,
      submissionId: submissions.submissionId,
      title: submissions.title,
      features: submissions.features,
      projectId: authors.projectId,
    })
    .from(authors)
    .leftJoin(
      submissions,
      and(
        eq(submissions.projectId, authors.projectId),
        eq(submissions.submissionId, authors.submissionId),
      ),
    )
    .where(
      and(
        inArray(authors.projectId, authorProjects),
        eq(authors.email, reviewer.email),
      ),
    );

  // Use each control ID once, preferring this project's row (its id is used
  // to exclude the reviewer's own submissions from the bidding list)
  const byControlId = new Map<string, (typeof submissionRows)[number]>();
  for (const s of submissionRows) {
    if (s.submissionId === null) continue;
    const existing = byControlId.get(s.submissionId);
    if (!existing || (existing.projectId !== projectId && s.projectId === projectId))
      byControlId.set(s.submissionId, s);
  }
  const ownSubmissions = [...byControlId.values()].map(
    ({ projectId, ...s }) => s,
  );
  const submissionExternalIds = [...byControlId.keys()];

  if (submissionExternalIds.length === 0) {
    return NextResponse.json({
      id: reviewer.id,
      email: reviewer.email,
      bids: reviewer.biddings,
      submissionIds: [],
      submissions: [],
      conflictSubmissionIds: [],
    });
  }

  // Scoped to this project (and the reference project for co-authors).
  // Control IDs can occur in many projects, so joining on control ID alone
  // would pull in (duplicate) rows from every project in the system
  const conflictAuthors = db
    .selectDistinct({ email: authors.email })
    .from(authors)
    .where(
      or(
        and(
          inArray(authors.projectId, authorProjects),
          inArray(authors.submissionId, submissionExternalIds),
        ),
        // an empty institution (e.g., self-registered volunteers) is not a conflict
        reviewer.institution
          ? and(
              eq(authors.projectId, projectId),
              eq(authors.institution, reviewer.institution),
            )
          : undefined,
      ),
    )
    .as("conflictAuthors");

  const conflictSubmissions = await db
    .selectDistinct({ id: submissions.id })
    .from(authors)
    .innerJoin(conflictAuthors, eq(authors.email, conflictAuthors.email))
    .innerJoin(
      submissions,
      and(
        eq(submissions.projectId, authors.projectId),
        eq(submissions.submissionId, authors.submissionId),
      ),
    )
    .where(eq(authors.projectId, projectId));

  return NextResponse.json({
    id: reviewer.id,
    email: reviewer.email,
    bids: reviewer.biddings,
    submissionIds: ownSubmissions.map((s) => s.id),
    submissions: ownSubmissions,
    conflictSubmissionIds: conflictSubmissions.map((s) => s.id),
  });
}
