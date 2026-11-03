import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { admins } from "@cp/db";
import { router, userEmail } from "../context";
import { requireUser } from "../middleware";
import { isSuperadmin, normalizeEmail } from "../permissions";

/** Admins can create conferences. Only superadmins manage this list */
export const adminRoutes = router()
  .use(requireUser)
  .use(async (c, next) => {
    if (!isSuperadmin(c.env, userEmail(c))) return c.json({ error: "Not authorized" }, 403);
    await next();
  })
  .get("/", async (c) => {
    const rows = await c.get("db").select().from(admins).orderBy(admins.email);
    return c.json(rows.map((r) => ({ email: r.email, createdAt: r.createdAt })));
  })
  .post("/", zValidator("json", z.object({ email: z.string().email() })), async (c) => {
    const email = normalizeEmail(c.req.valid("json").email);
    await c.get("db").insert(admins).values({ email }).onConflictDoNothing();
    return c.json({ email }, 201);
  })
  .delete("/:email", async (c) => {
    const email = normalizeEmail(c.req.param("email"));
    await c.get("db").delete(admins).where(eq(admins.email, email));
    return c.json({ email });
  });
