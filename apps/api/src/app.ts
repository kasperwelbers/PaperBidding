import { Hono } from "hono";
import { sql } from "drizzle-orm";
import { createDb } from "@cp/db";

export type Bindings = Env;

// Routes are chained, so the type of `app` describes the whole API. The web
// app uses it for a typed client (hono/client)
export const app = new Hono<{ Bindings: Bindings }>()
  .basePath("/api")
  .get("/health", async (c) => {
    const db = createDb(c.env.DB);
    const result = await db.get<{ ok: number }>(sql`select 1 as ok`);
    return c.json({ ok: result?.ok === 1, service: "conference-planner" });
  });

export type AppType = typeof app;
