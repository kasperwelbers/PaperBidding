import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { conferences, divisionEditions, divisions, editions, personIdentifiers, reviewerDivisions, reviewers } from "@cp/db";
import { router, userEmail } from "../context";
import { resolvePersons } from "../imports/persons";
import { requireUser } from "../middleware";
import { addToPool } from "../pool";
import { randomToken } from "../util";

/** The general join link of a division: anyone with the link can sign in and
 *  join the division's reviewer pool */
async function loadLink(db: any, divisionEditionId: number, token: string) {
  const de = await db.query.divisionEditions.findFirst({ where: eq(divisionEditions.id, divisionEditionId) });
  if (!de || !token || de.joinToken !== token) return null;
  const division = await db.query.divisions.findFirst({ where: eq(divisions.id, de.divisionId) });
  const edition = await db.query.editions.findFirst({ where: eq(editions.id, de.editionId) });
  const conference = await db.query.conferences.findFirst({ where: eq(conferences.id, division.conferenceId) });
  return { de, division, edition, conference };
}

export const joinRoutes = router()
  /** Works without signing in. `joined`: whether the signed in user is
   *  already in the pool */
  .get("/:divisionEditionId", zValidator("query", z.object({ token: z.string() })), async (c) => {
    const db = c.get("db");
    const link = await loadLink(db, Number(c.req.param("divisionEditionId")), c.req.valid("query").token);
    if (!link) return c.json({ error: "This link is not valid (anymore)" }, 404);

    let joined = false;
    const email = c.get("email");
    if (email) {
      const rows = await db
        .select({ id: reviewers.id })
        .from(personIdentifiers)
        .innerJoin(reviewers, and(eq(reviewers.personId, personIdentifiers.personId), eq(reviewers.editionId, link.edition.id)))
        .innerJoin(reviewerDivisions, and(eq(reviewerDivisions.reviewerId, reviewers.id), eq(reviewerDivisions.divisionId, link.division.id)))
        .where(
          and(
            eq(personIdentifiers.conferenceId, link.conference.id),
            eq(personIdentifiers.kind, "email"),
            eq(personIdentifiers.value, email),
          ),
        )
        .limit(1);
      joined = rows.length > 0;
    }
    return c.json({
      conference: link.conference.name as string,
      division: link.division.name as string,
      edition: link.edition.name as string,
      biddingDeadline: link.de.biddingDeadline as Date | null,
      signedInAs: email,
      joined,
    });
  })
  .post(
    "/:divisionEditionId",
    requireUser,
    zValidator("json", z.object({ token: z.string(), student: z.boolean() })),
    async (c) => {
      const db = c.get("db");
      const body = c.req.valid("json");
      const link = await loadLink(db, Number(c.req.param("divisionEditionId")), body.token);
      if (!link) return c.json({ error: "This link is not valid (anymore)" }, 404);
      const ctx = { conferenceId: link.conference.id, editionId: link.edition.id, importJobId: null };
      const { ids } = await resolvePersons(db, ctx, "join_link", [{ emails: [userEmail(c)] }]);
      await addToPool(db, {
        editionId: link.edition.id,
        divisionId: link.division.id,
        personId: ids[0]!,
        source: "join_link",
        secret: randomToken(),
        student: body.student,
      });
      return c.json({ joined: true });
    },
  );
