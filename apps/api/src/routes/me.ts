import { router, userEmail } from "../context";
import { requireUser } from "../middleware";
import { isAdmin, isSuperadmin } from "../permissions";

export const meRoutes = router()
  .use(requireUser)
  .get("/", async (c) => {
    const email = userEmail(c);
    return c.json({
      email,
      isSuperadmin: isSuperadmin(c.env, email),
      isAdmin: await isAdmin(c.env, c.get("db"), email),
    });
  });
