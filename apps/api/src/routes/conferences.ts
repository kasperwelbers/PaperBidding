import { zValidator } from "@hono/zod-validator";
import { and, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import {
  conferenceUsers,
  conferences,
  divisions,
  editions,
  plannerDivisions,
  type Db,
} from "@cp/db";
import { isUniqueViolation, router, userEmail, type AppEnv } from "../context";
import { requireUser } from "../middleware";
import { importRoutes } from "./imports";
import { importConflictRoutes, keywordRoutes } from "./keywords";
import { loadEdition, requireConferenceAdmin } from "./shared";
import { summaryRoutes } from "./summary";
import { conferenceInstitutionRoutes } from "./institutions";
import {
  canView,
  conferenceRole,
  isAdmin,
  isSuperadmin,
  normalizeEmail,
  type ConferenceRole,
} from "../permissions";
import { platformIds, platforms } from "../platforms";
import { createMiddleware } from "hono/factory";

const id = z.coerce.number().int().positive();
const name = z.string().trim().min(1).max(200);

/** Resolves the conference and the user's role, and checks they can view it */
const loadConference = createMiddleware<AppEnv>(async (c, next) => {
  const conferenceId = Number(c.req.param("conferenceId"));
  if (!Number.isInteger(conferenceId)) return c.json({ error: "Not found" }, 404);
  const role = await conferenceRole(c.env, c.get("db"), userEmail(c), conferenceId);
  if (!canView(role)) return c.json({ error: "Not found" }, 404);
  c.set("conferenceId", conferenceId);
  c.set("role", role);
  await next();
});



/** Throws if a division id does not belong to the conference */
async function checkDivisions(db: Db, conferenceId: number, divisionIds: number[]) {
  if (divisionIds.length === 0) return true;
  const rows = await db
    .select({ id: divisions.id })
    .from(divisions)
    .where(and(eq(divisions.conferenceId, conferenceId), inArray(divisions.id, divisionIds)));
  return rows.length === new Set(divisionIds).size;
}

async function adminCount(db: Db, conferenceId: number) {
  const [row] = await db
    .select({ n: sql<number>`count(*)` })
    .from(conferenceUsers)
    .where(and(eq(conferenceUsers.conferenceId, conferenceId), eq(conferenceUsers.role, "admin")));
  return row?.n ?? 0;
}

// --- divisions ---

const divisionRoutes = router()
  .get("/", async (c) => {
    const conferenceId = c.get("conferenceId");
    const rows = await c
      .get("db")
      .select()
      .from(divisions)
      .where(eq(divisions.conferenceId, conferenceId))
      .orderBy(divisions.name);
    return c.json(rows);
  })
  .post(
    "/",
    requireConferenceAdmin,
    zValidator("json", z.object({ name, platformKey: z.string().trim().optional() })),
    async (c) => {
      const conferenceId = c.get("conferenceId");
      const body = c.req.valid("json");
      try {
        const [row] = await c
          .get("db")
          .insert(divisions)
          .values({
            conferenceId,
            name: body.name,
            // by default the division is recognized in the platform by its name
            platformKey: body.platformKey || body.name,
          })
          .returning();
        return c.json(row!, 201);
      } catch (e) {
        if (isUniqueViolation(e)) return c.json({ error: "A division with this name exists" }, 409);
        throw e;
      }
    },
  )
  .patch(
    "/:divisionId",
    requireConferenceAdmin,
    zValidator("json", z.object({ name: name.optional(), platformKey: z.string().trim().optional() })),
    async (c) => {
      const conferenceId = c.get("conferenceId");
      const divisionId = id.parse(c.req.param("divisionId"));
      try {
        const [row] = await c
          .get("db")
          .update(divisions)
          .set(c.req.valid("json"))
          .where(and(eq(divisions.id, divisionId), eq(divisions.conferenceId, conferenceId)))
          .returning();
        if (!row) return c.json({ error: "Not found" }, 404);
        return c.json(row);
      } catch (e) {
        if (isUniqueViolation(e)) return c.json({ error: "A division with this name exists" }, 409);
        throw e;
      }
    },
  )
  .delete("/:divisionId", requireConferenceAdmin, async (c) => {
    const conferenceId = c.get("conferenceId");
    const divisionId = id.parse(c.req.param("divisionId"));
    await c
      .get("db")
      .delete(divisions)
      .where(and(eq(divisions.id, divisionId), eq(divisions.conferenceId, conferenceId)));
    return c.json({ id: divisionId });
  });

// --- conference users ---

const userBody = z.object({
  email: z.string().email(),
  role: z.enum(["admin", "planner"]),
  /** for planners: the divisions they work on */
  divisionIds: z.array(id).default([]),
});

const userRoutes = router()
  .get("/", async (c) => {
    const conferenceId = c.get("conferenceId");
    const db = c.get("db");
    const users = await db
      .select()
      .from(conferenceUsers)
      .where(eq(conferenceUsers.conferenceId, conferenceId))
      .orderBy(conferenceUsers.email);
    const links =
      users.length === 0
        ? []
        : await db
            .select()
            .from(plannerDivisions)
            .where(inArray(plannerDivisions.conferenceUserId, users.map((u) => u.id)));
    return c.json(
      users.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
        divisionIds: links.filter((l) => l.conferenceUserId === u.id).map((l) => l.divisionId),
      })),
    );
  })
  .post("/", requireConferenceAdmin, zValidator("json", userBody), async (c) => {
    const conferenceId = c.get("conferenceId");
    const db = c.get("db");
    const body = c.req.valid("json");
    if (!(await checkDivisions(db, conferenceId, body.divisionIds)))
      return c.json({ error: "Unknown division" }, 400);
    try {
      const [user] = await db
        .insert(conferenceUsers)
        .values({ conferenceId, email: normalizeEmail(body.email), role: body.role })
        .returning();
      if (body.divisionIds.length > 0)
        await db
          .insert(plannerDivisions)
          .values(body.divisionIds.map((divisionId) => ({ conferenceUserId: user!.id, divisionId })));
      return c.json({ ...user!, divisionIds: body.divisionIds }, 201);
    } catch (e) {
      if (isUniqueViolation(e)) return c.json({ error: "This user is already in the conference" }, 409);
      throw e;
    }
  })
  .patch(
    "/:userId",
    requireConferenceAdmin,
    zValidator("json", userBody.omit({ email: true }).partial()),
    async (c) => {
      const conferenceId = c.get("conferenceId");
      const db = c.get("db");
      const userId = id.parse(c.req.param("userId"));
      const body = c.req.valid("json");
      const user = await db.query.conferenceUsers.findFirst({
        where: and(eq(conferenceUsers.id, userId), eq(conferenceUsers.conferenceId, conferenceId)),
      });
      if (!user) return c.json({ error: "Not found" }, 404);
      if (body.role === "planner" && user.role === "admin" && (await adminCount(db, conferenceId)) <= 1)
        return c.json({ error: "A conference needs at least one admin" }, 400);
      if (body.divisionIds && !(await checkDivisions(db, conferenceId, body.divisionIds)))
        return c.json({ error: "Unknown division" }, 400);

      if (body.role) await db.update(conferenceUsers).set({ role: body.role }).where(eq(conferenceUsers.id, userId));
      if (body.divisionIds) {
        // replace the set of divisions
        await db.batch([
          db.delete(plannerDivisions).where(eq(plannerDivisions.conferenceUserId, userId)),
          ...body.divisionIds.map((divisionId) =>
            db.insert(plannerDivisions).values({ conferenceUserId: userId, divisionId }),
          ),
        ]);
      }
      return c.json({ id: userId });
    },
  )
  .delete("/:userId", requireConferenceAdmin, async (c) => {
    const conferenceId = c.get("conferenceId");
    const db = c.get("db");
    const userId = id.parse(c.req.param("userId"));
    const user = await db.query.conferenceUsers.findFirst({
      where: and(eq(conferenceUsers.id, userId), eq(conferenceUsers.conferenceId, conferenceId)),
    });
    if (!user) return c.json({ error: "Not found" }, 404);
    if (user.role === "admin" && (await adminCount(db, conferenceId)) <= 1)
      return c.json({ error: "A conference needs at least one admin" }, 400);
    await db.delete(conferenceUsers).where(eq(conferenceUsers.id, userId));
    return c.json({ id: userId });
  });

// --- editions ---

const editionRoutes = router()
  .get("/", async (c) => {
    const conferenceId = c.get("conferenceId");
    const rows = await c
      .get("db")
      .select()
      .from(editions)
      .where(eq(editions.conferenceId, conferenceId))
      .orderBy(sql`${editions.createdAt} desc`);
    return c.json(rows);
  })
  .post("/", requireConferenceAdmin, zValidator("json", z.object({ name })), async (c) => {
    const conferenceId = c.get("conferenceId");
    try {
      const [row] = await c
        .get("db")
        .insert(editions)
        .values({ conferenceId, name: c.req.valid("json").name })
        .returning();
      return c.json(row!, 201);
    } catch (e) {
      if (isUniqueViolation(e)) return c.json({ error: "An edition with this name exists" }, 409);
      throw e;
    }
  })
  .patch(
    "/:editionId",
    requireConferenceAdmin,
    zValidator("json", z.object({ name })),
    async (c) => {
      const conferenceId = c.get("conferenceId");
      const editionId = id.parse(c.req.param("editionId"));
      try {
        const [row] = await c
          .get("db")
          .update(editions)
          .set({ name: c.req.valid("json").name })
          .where(and(eq(editions.id, editionId), eq(editions.conferenceId, conferenceId)))
          .returning();
        if (!row) return c.json({ error: "Not found" }, 404);
        return c.json(row);
      } catch (e) {
        if (isUniqueViolation(e)) return c.json({ error: "An edition with this name exists" }, 409);
        throw e;
      }
    },
  )
  .use("/:editionId/*", loadEdition)
  .route("/:editionId/imports", importRoutes)
  .route("/:editionId/summary", summaryRoutes);

// --- conferences ---

export const conferenceRoutes = router()
  .use(requireUser)
  .get("/", async (c) => {
    const db = c.get("db");
    const email = userEmail(c);
    if (isSuperadmin(c.env, email)) {
      const rows = await db.select().from(conferences).orderBy(conferences.name);
      return c.json(rows.map((r) => ({ id: r.id, name: r.name, platform: r.platform, role: "admin" as ConferenceRole })));
    }
    const rows = await db
      .select({
        id: conferences.id,
        name: conferences.name,
        platform: conferences.platform,
        role: conferenceUsers.role,
      })
      .from(conferenceUsers)
      .innerJoin(conferences, eq(conferences.id, conferenceUsers.conferenceId))
      .where(eq(conferenceUsers.email, email))
      .orderBy(conferences.name);
    return c.json(rows);
  })
  .post(
    "/",
    zValidator(
      "json",
      z.object({ name, platform: z.enum(platformIds), preset: z.string().optional() }),
    ),
    async (c) => {
      const db = c.get("db");
      const email = userEmail(c);
      if (!(await isAdmin(c.env, db, email)))
        return c.json({ error: "Only admins can create conferences" }, 403);

      const body = c.req.valid("json");
      const presets = platforms[body.platform].presets as readonly { id: string; settings: object }[];
      const preset = body.preset ? presets.find((p) => p.id === body.preset) : undefined;
      if (body.preset && !preset) return c.json({ error: "Unknown preset" }, 400);

      const [conference] = await db
        .insert(conferences)
        .values({
          name: body.name,
          platform: body.platform,
          preset: preset?.id ?? null,
          settings: structuredClone((preset?.settings ?? {}) as Record<string, unknown>),
          createdBy: email,
        })
        .returning();
      // the creator is the first conference admin
      await db
        .insert(conferenceUsers)
        .values({ conferenceId: conference!.id, email, role: "admin" });
      return c.json(conference!, 201);
    },
  )
  .use("/:conferenceId/*", loadConference)
  .use("/:conferenceId", loadConference)
  .get("/:conferenceId", async (c) => {
    const conference = await c.get("db").query.conferences.findFirst({
      where: eq(conferences.id, c.get("conferenceId")),
    });
    if (!conference) return c.json({ error: "Not found" }, 404);
    return c.json({ ...conference, role: c.get("role")! });
  })
  .patch(
    "/:conferenceId",
    requireConferenceAdmin,
    zValidator(
      "json",
      z.object({
        name: name.optional(),
        settings: z.record(z.string(), z.unknown()).optional(),
        conflictRules: z
          .object({
            coAuthorsCurrentEdition: z.boolean(),
            coAuthorsPreviousEditions: z.boolean(),
            sameInstitution: z.boolean(),
          })
          .optional(),
      }),
    ),
    async (c) => {
        const [row] = await c
        .get("db")
        .update(conferences)
        .set(c.req.valid("json"))
        .where(eq(conferences.id, c.get("conferenceId")))
        .returning();
      return c.json(row!);
    },
  )
  .route("/:conferenceId/divisions", divisionRoutes)
  .route("/:conferenceId/users", userRoutes)
  .route("/:conferenceId/editions", editionRoutes)
  .route("/:conferenceId/keywords", keywordRoutes)
  .route("/:conferenceId/import-conflicts", importConflictRoutes)
  .route("/:conferenceId/institutions", conferenceInstitutionRoutes);
