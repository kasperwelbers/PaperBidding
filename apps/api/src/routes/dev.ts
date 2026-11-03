import { conferenceUsers, conferences, divisions, editions } from "@cp/db";
import { icaPreset } from "@cp/adapter-scholarone";
import { router, userEmail } from "../context";
import { demoData } from "../dev/demo";
import { startImportFromText } from "../imports/jobs";
import { requireUser } from "../middleware";
import { isSuperadmin } from "../permissions";

/** Development only: load a synthetic demo conference */
export const devRoutes = router()
  .use(requireUser)
  .use(async (c, next) => {
    const dev = c.env.ENVIRONMENT === "development" || c.env.ENVIRONMENT === "test";
    if (!dev || !isSuperadmin(c.env, userEmail(c))) return c.json({ error: "Not found" }, 404);
    await next();
  })
  .post("/demo", async (c) => {
    const db = c.get("db");
    const email = userEmail(c);
    const data = demoData();

    const [conference] = await db
      .insert(conferences)
      .values({
        name: `Demo conference ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
        platform: "scholarone",
        preset: icaPreset.id,
        settings: structuredClone(icaPreset.settings) as unknown as Record<string, unknown>,
        createdBy: email,
      })
      .returning();
    const conferenceId = conference!.id;
    await db.insert(conferenceUsers).values({ conferenceId, email, role: "admin" });
    await db.insert(divisions).values(data.divisions.map((name) => ({ conferenceId, name, platformKey: name })));
    const [previous] = await db.insert(editions).values({ conferenceId, name: "Demo 2026" }).returning();
    const [current] = await db.insert(editions).values({ conferenceId, name: "Demo 2027" }).returning();

    const start = (editionId: number, kind: "submissions" | "reviewers", filename: string, text: string) =>
      startImportFromText(c.env, db, { conferenceId, editionId, kind, filename, text, createdBy: email });
    await start(previous!.id, "submissions", "demo-submissions-2026.csv", data.previousSubmissions);
    await start(current!.id, "submissions", "demo-submissions-2027.csv", data.submissions);
    await start(current!.id, "reviewers", "demo-reviewers-2027.csv", data.reviewers);

    return c.json({ conferenceId, editionId: current!.id }, 201);
  });
