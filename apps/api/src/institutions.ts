import { eq } from "drizzle-orm";
import { institutionResolver } from "@cp/institutions";
import { institutionAliases, type Db } from "@cp/db";

/** The conference's institution aliases: normalized raw text -> institution */
export async function loadAliases(db: Db, conferenceId: number) {
  const rows = await db
    .select({ raw: institutionAliases.raw, institution: institutionAliases.institution })
    .from(institutionAliases)
    .where(eq(institutionAliases.conferenceId, conferenceId));
  return new Map(rows.map((r) => [r.raw, r.institution]));
}

/** A resolve function with the conference's aliases */
export async function conferenceResolver(db: Db, conferenceId: number) {
  const aliases = await loadAliases(db, conferenceId);
  const resolver = institutionResolver();
  return (email: string | undefined, raw: string | undefined) =>
    resolver.resolve({ email, raw }, aliases).name;
}
