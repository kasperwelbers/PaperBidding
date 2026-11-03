import { and, eq } from "drizzle-orm";
import { createMiddleware } from "hono/factory";
import { editions } from "@cp/db";
import type { AppEnv } from "../context";
import { canEditConference } from "../permissions";

export const requireConferenceAdmin = createMiddleware<AppEnv>(async (c, next) => {
  if (!canEditConference(c.get("role")))
    return c.json({ error: "Only conference admins can do this" }, 403);
  await next();
});

/** Checks that the edition belongs to the conference (after loadConference) */
export const loadEdition = createMiddleware<AppEnv>(async (c, next) => {
  const editionId = Number(c.req.param("editionId"));
  const edition = Number.isInteger(editionId)
    ? await c.get("db").query.editions.findFirst({
        where: and(eq(editions.id, editionId), eq(editions.conferenceId, c.get("conferenceId"))),
      })
    : undefined;
  if (!edition) return c.json({ error: "Not found" }, 404);
  c.set("editionId", editionId);
  await next();
});
