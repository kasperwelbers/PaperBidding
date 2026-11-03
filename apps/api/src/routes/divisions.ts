import { zValidator } from "@hono/zod-validator";
import { and, asc, eq, inArray, ne, sql } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { z } from "zod";
import {
  divisionEditions,
  divisionReviewerExclusions,
  divisions,
  editions,
  personIdentifiers,
  persons,
  reviewerDivisions,
  submissionAuthors,
  submissions,
} from "@cp/db";
import { router, userEmail, type AppEnv } from "../context";
import { chunkValues } from "../imports/d1";
import { resolvePersons } from "../imports/persons";
import { canEditDivision, normalizeEmail } from "../permissions";
import { addToPool, divisionPool, divisionsOfReviewers } from "../pool";
import { referenceCounts, referenceScope } from "../references";
import { randomToken } from "../util";

/** The division (of this conference) and its settings for this edition
 *  (created on first use) */
export const loadDivision = createMiddleware<AppEnv>(async (c, next) => {
  const db = c.get("db");
  const divisionId = Number(c.req.param("divisionId"));
  const division = Number.isInteger(divisionId)
    ? await db.query.divisions.findFirst({
        where: and(eq(divisions.id, divisionId), eq(divisions.conferenceId, c.get("conferenceId"))),
      })
    : undefined;
  if (!division) return c.json({ error: "Not found" }, 404);
  const editionId = c.get("editionId");
  await db
    .insert(divisionEditions)
    .values({ divisionId, editionId, joinToken: randomToken() })
    .onConflictDoNothing();
  const de = (await db.query.divisionEditions.findFirst({
    where: and(eq(divisionEditions.divisionId, divisionId), eq(divisionEditions.editionId, editionId)),
  }))!;
  c.set("divisionId", divisionId);
  c.set("divisionEditionId", de.id);
  c.set("canEditDivision", await canEditDivision(c.env, db, userEmail(c), divisionId));
  await next();
});

const requireDivisionEditor = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("canEditDivision"))
    return c.json({ error: "Only the division's planners and conference admins can do this" }, 403);
  await next();
});

async function loadSettings(c: { get: (k: "db") => any } & { get: (k: "divisionEditionId") => number }) {
  return (await c.get("db").query.divisionEditions.findFirst({
    where: eq(divisionEditions.id, c.get("divisionEditionId")),
  }))!;
}

export const divisionRoutes = router()
  .get("/", async (c) => {
    const db = c.get("db");
    const de = await loadSettings(c);
    const division = await db.query.divisions.findFirst({ where: eq(divisions.id, c.get("divisionId")) });
    const edition = await db.query.editions.findFirst({ where: eq(editions.id, c.get("editionId")) });
    return c.json({
      division: { id: division!.id, name: division!.name },
      edition: { id: edition!.id, name: edition!.name },
      divisionEditionId: de.id,
      canEdit: c.get("canEditDivision"),
      biddingDeadline: de.biddingDeadline,
      referenceSources: de.referenceSources,
      // the join link is for the division's planners to share
      joinToken: c.get("canEditDivision") ? de.joinToken : null,
    });
  })
  .patch(
    "/",
    requireDivisionEditor,
    zValidator(
      "json",
      z.object({
        referenceSources: z
          .object({ divisionIds: z.array(z.number().int()), editionIds: z.array(z.number().int()) })
          .optional(),
        biddingDeadline: z.coerce.date().nullable().optional(),
      }),
    ),
    async (c) => {
      const db = c.get("db");
      const body = c.req.valid("json");
      const conferenceId = c.get("conferenceId");
      if (body.referenceSources) {
        const { divisionIds, editionIds } = body.referenceSources;
        const okDivisions = divisionIds.length
          ? await db
              .select({ id: divisions.id })
              .from(divisions)
              .where(
                and(
                  eq(divisions.conferenceId, conferenceId),
                  inArray(divisions.id, divisionIds),
                  ne(divisions.id, c.get("divisionId")),
                ),
              )
          : [];
        const okEditions = editionIds.length
          ? await db
              .select({ id: editions.id })
              .from(editions)
              .where(
                and(
                  eq(editions.conferenceId, conferenceId),
                  inArray(editions.id, editionIds),
                  ne(editions.id, c.get("editionId")),
                ),
              )
          : [];
        if (okDivisions.length !== new Set(divisionIds).size || okEditions.length !== new Set(editionIds).size)
          return c.json({ error: "Unknown division or edition" }, 400);
      }
      const [row] = await db
        .update(divisionEditions)
        .set({
          ...(body.referenceSources ? { referenceSources: body.referenceSources } : {}),
          ...(body.biddingDeadline !== undefined ? { biddingDeadline: body.biddingDeadline } : {}),
        })
        .where(eq(divisionEditions.id, c.get("divisionEditionId")))
        .returning();
      return c.json({ referenceSources: row!.referenceSources, biddingDeadline: row!.biddingDeadline });
    },
  )
  /** A new join token: the old join link stops working */
  .post("/join-token", requireDivisionEditor, async (c) => {
    const joinToken = randomToken();
    await c
      .get("db")
      .update(divisionEditions)
      .set({ joinToken })
      .where(eq(divisionEditions.id, c.get("divisionEditionId")));
    return c.json({ joinToken });
  })
  .get("/submissions", async (c) => {
    const db = c.get("db");
    const rows = await db
      .select({
        id: submissions.id,
        externalId: submissions.externalId,
        title: submissions.title,
        status: submissions.status,
        hasEmbedding: sql<number>`${submissions.embedding} is not null`,
      })
      .from(submissions)
      .where(and(eq(submissions.editionId, c.get("editionId")), eq(submissions.divisionId, c.get("divisionId"))))
      .orderBy(asc(submissions.externalId));
    const authors = new Map<number, { name: string | null; email: string | null; institution: string | null }[]>();
    for (const part of chunkValues(rows.map((r) => r.id))) {
      const list = await db
        .select({
          submissionId: submissionAuthors.submissionId,
          name: persons.name,
          institution: submissionAuthors.institution,
          email: sql<string | null>`(select value from person_identifiers pi where pi.person_id = ${persons.id} and pi.kind = 'email' order by pi.id limit 1)`,
        })
        .from(submissionAuthors)
        .innerJoin(persons, eq(persons.id, submissionAuthors.personId))
        .where(inArray(submissionAuthors.submissionId, part))
        .orderBy(submissionAuthors.position);
      for (const a of list) {
        const l = authors.get(a.submissionId) ?? [];
        l.push({ name: a.name, email: a.email, institution: a.institution });
        authors.set(a.submissionId, l);
      }
    }
    return c.json(rows.map((r) => ({ ...r, hasEmbedding: r.hasEmbedding === 1, authors: authors.get(r.id) ?? [] })));
  })
  /** The reviewer pool, including excluded reviewers (marked) */
  .get("/reviewers", async (c) => {
    const db = c.get("db");
    const editionId = c.get("editionId");
    const divisionId = c.get("divisionId");
    const de = await loadSettings(c);
    const pool = await divisionPool(db, editionId, divisionId);
    const personIds = pool.map((p) => p.personId);

    const people = new Map<number, { name: string | null; institution: string | null }>();
    const ids = new Map<number, { emails: string[]; platformId: string | null }>();
    const authorsHere = new Set<number>();
    for (const part of chunkValues(personIds, 80)) {
      for (const p of await db
        .select({ id: persons.id, name: persons.name, institution: persons.institution })
        .from(persons)
        .where(inArray(persons.id, part)))
        people.set(p.id, p);
      for (const i of await db
        .select()
        .from(personIdentifiers)
        .where(inArray(personIdentifiers.personId, part))
        .orderBy(personIdentifiers.id)) {
        const entry = ids.get(i.personId) ?? { emails: [], platformId: null };
        if (i.kind === "email") entry.emails.push(i.value);
        else entry.platformId ??= i.value;
        ids.set(i.personId, entry);
      }
      for (const a of await db
        .selectDistinct({ personId: submissionAuthors.personId })
        .from(submissionAuthors)
        .innerJoin(submissions, eq(submissions.id, submissionAuthors.submissionId))
        .where(
          and(
            inArray(submissionAuthors.personId, part),
            eq(submissions.editionId, editionId),
            eq(submissions.divisionId, divisionId),
          ),
        ))
        authorsHere.add(a.personId);
    }
    const divisionCounts = await divisionsOfReviewers(db, pool.map((p) => p.reviewerId));
    const basis = await referenceCounts(db, personIds, referenceScope(editionId, divisionId, de.referenceSources));

    return c.json(
      pool
        .map((p) => ({
          reviewerId: p.reviewerId,
          name: people.get(p.personId)?.name ?? null,
          institution: people.get(p.personId)?.institution ?? null,
          emails: ids.get(p.personId)?.emails ?? [],
          platformId: ids.get(p.personId)?.platformId ?? null,
          student: p.student,
          canReview: p.canReview,
          sources: p.sources,
          excluded: p.excluded,
          divisions: divisionCounts.get(p.reviewerId)?.size ?? 0,
          authorHere: authorsHere.has(p.personId),
          /** own submissions in the reference sources (the basis for similarity) */
          ownSubmissions: basis.get(p.personId) ?? 0,
        }))
        .sort((a, b) => (a.emails[0] ?? "").localeCompare(b.emails[0] ?? "")),
    );
  })
  /** Add someone by email (a new person if they are not known yet) */
  .post(
    "/reviewers",
    requireDivisionEditor,
    zValidator("json", z.object({ email: z.string().email(), student: z.boolean().optional() })),
    async (c) => {
      const db = c.get("db");
      const ctx = { conferenceId: c.get("conferenceId"), editionId: c.get("editionId"), importJobId: null };
      const email = normalizeEmail(c.req.valid("json").email);
      const { ids } = await resolvePersons(db, ctx, "planner", [{ emails: [email] }]);
      const reviewer = await addToPool(db, {
        editionId: ctx.editionId,
        divisionId: c.get("divisionId"),
        personId: ids[0]!,
        source: "planner",
        secret: randomToken(),
        student: c.req.valid("json").student,
      });
      return c.json({ reviewerId: reviewer.id }, 201);
    },
  )
  /** Take a reviewer out of this division's pool (other divisions keep them) */
  .delete("/reviewers/:reviewerId", requireDivisionEditor, async (c) => {
    const db = c.get("db");
    const divisionId = c.get("divisionId");
    const reviewerId = Number(c.req.param("reviewerId"));
    const pool = await divisionPool(db, c.get("editionId"), divisionId);
    const reviewer = pool.find((p) => p.reviewerId === reviewerId);
    if (!reviewer) return c.json({ error: "Not found" }, 404);
    // links added in this division can be removed; keyword links come from the
    // central import, so those are excluded instead
    await db
      .delete(reviewerDivisions)
      .where(
        and(
          eq(reviewerDivisions.reviewerId, reviewerId),
          eq(reviewerDivisions.divisionId, divisionId),
          inArray(reviewerDivisions.source, ["planner", "join_link"]),
        ),
      );
    if (reviewer.sources.includes("keyword"))
      await db
        .insert(divisionReviewerExclusions)
        .values({ reviewerId, divisionId, createdBy: userEmail(c) })
        .onConflictDoNothing();
    return c.json({ reviewerId });
  })
  .post("/reviewers/:reviewerId/include", requireDivisionEditor, async (c) => {
    await c
      .get("db")
      .delete(divisionReviewerExclusions)
      .where(
        and(
          eq(divisionReviewerExclusions.reviewerId, Number(c.req.param("reviewerId"))),
          eq(divisionReviewerExclusions.divisionId, c.get("divisionId")),
        ),
      );
    return c.json({ reviewerId: Number(c.req.param("reviewerId")) });
  });
