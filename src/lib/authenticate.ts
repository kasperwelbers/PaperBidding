import db, { reviewers, biddings } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import { auth } from "@/auth/auth";

export { isSuperAdmin, canEditProject, canCreateProject } from "./permissions";

export async function authenticate() {
  const session = await auth.api.getSession({ headers: await headers() });
  return (
    session?.user || {
      email: undefined,
      canCreateProject: false,
      isSuperAdmin: false,
    }
  );
}

interface AuthenticatedReviewer {
  projectId: number;
  id: number;
  email: string;
  firstname: string;
  secret: string;
  biddings: number[];
}

export async function authenticateReviewer(req: Request) {
  const token = req.headers.get("Authorization");
  if (!token) return undefined;

  const [id, secret] = token.split("/");
  const reviewer = await db
    .select({
      projectId: reviewers.projectId,
      id: reviewers.id,
      email: reviewers.email,
      institution: reviewers.institution,
      secret: reviewers.secret,
      biddings: biddings.submissionIds,
    })
    .from(reviewers)
    .where(eq(reviewers.id, Number(id)))
    .leftJoin(
      biddings,
      and(
        eq(biddings.projectId, reviewers.projectId),
        eq(biddings.email, reviewers.email),
      ),
    );

  let r = reviewer[0];

  if (r === undefined) return undefined;
  if (secret !== r.secret) return undefined;
  return r;
}
