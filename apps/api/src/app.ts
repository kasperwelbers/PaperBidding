import { sql } from "drizzle-orm";
import { router } from "./context";
import { setup } from "./middleware";
import { adminRoutes } from "./routes/admins";
import { conferenceRoutes } from "./routes/conferences";
import { meRoutes } from "./routes/me";
import { platformRoutes } from "./routes/platforms";
import { institutionSearchRoutes } from "./routes/institutions";
import { devRoutes } from "./routes/dev";

// Routes are chained, so the type of `app` describes the whole API. The web
// app uses it for a typed client (hono/client)
export const app = router()
  .basePath("/api")
  .use(setup)
  .on(["GET", "POST"], "/auth/*", (c) => c.get("auth").handler(c.req.raw))
  .get("/health", async (c) => {
    const result = await c.get("db").get<{ ok: number }>(sql`select 1 as ok`);
    return c.json({ ok: result?.ok === 1, service: "conference-planner" });
  })
  .route("/me", meRoutes)
  .route("/admins", adminRoutes)
  .route("/platforms", platformRoutes)
  .route("/conferences", conferenceRoutes)
  .route("/institutions", institutionSearchRoutes)
  .route("/dev", devRoutes);

export type AppType = typeof app;
