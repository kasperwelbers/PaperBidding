import { createMiddleware } from "hono/factory";
import { createDb } from "@cp/db";
import { createAuth } from "./auth";
import type { AppEnv } from "./context";
import { normalizeEmail } from "./permissions";

/** Database, auth, and the signed in user for every request */
export const setup = createMiddleware<AppEnv>(async (c, next) => {
  const db = createDb(c.env.DB);
  const auth = createAuth(c.env, db, new URL(c.req.url).origin);
  c.set("db", db);
  c.set("auth", auth);

  let email: string | null = null;
  if (!c.req.path.startsWith("/api/auth/")) {
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    if (session?.user.email) email = normalizeEmail(session.user.email);
  }
  c.set("email", email);
  await next();
});

export const requireUser = createMiddleware<AppEnv>(async (c, next) => {
  if (!c.get("email")) return c.json({ error: "Not signed in" }, 401);
  await next();
});
