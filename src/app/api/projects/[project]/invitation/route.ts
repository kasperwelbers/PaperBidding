import { NextResponse } from "next/server";
import { authenticate, canEditProject } from "@/lib/authenticate";
import db, { reviewers } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request, props: { params: Promise<{ project: number }> }) {
  const params = await props.params;
  const { email } = await authenticate();
  if (!email)
    return NextResponse.json({}, { statusText: "Not signed in", status: 403 });

  const canEdit = await canEditProject(email, params.project);
  if (!canEdit) return NextResponse.json({}, { status: 403 });

  const { to, html, test, division } = await req.json();

  const [reviewer] = await db
    .select()
    .from(reviewers)
    .where(
      and(eq(reviewers.projectId, params.project), eq(reviewers.email, to)),
    );

  if (!test) {
    // Can only send emails to reviewers that exist (except for testing)
    if (!reviewer) return NextResponse.json({}, { status: 404 });
    // Check if invitation was sent in the last 1 hour. If so, skip and return 201
    if (reviewer.invitationSent) {
      const date = new Date(reviewer.invitationSent);
      if (date.getTime() > Date.now() - 1 * 60 * 60 * 1000) {
        return NextResponse.json({}, { status: 201 });
      }
    }
  }

  const message = {
    from: "ICA Paper Bidding <paperbidding@ica-cm.com>",
    to: [to],
    subject: `ICA Paper bidding for ${division} division`,
    html,
  };

  const response = await resend.emails.send(message);
  if (response.error) return NextResponse.json({}, { status: 400 });

  try {
    if (!test) {
      await db
        .update(reviewers)
        .set({ invitationSent: new Date() })
        .where(
          and(eq(reviewers.projectId, params.project), eq(reviewers.email, to)),
        );
    }
    return NextResponse.json({}, { status: 201 });
  } catch (e) {
    console.log(e);
    return NextResponse.json({}, { status: 400 });
  }
}
