import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { bids, submissions } from "@cp/db";
import type { Context } from "hono";
import { biddingList, biddingOpen, currentBids, resolveBidder } from "../bidding";
import { router, type AppEnv } from "../context";

/** For reviewers: a personal link (X-Bidding-Token header) or a session */
async function bidder(c: Context<AppEnv>) {
  return resolveBidder(c.get("db"), Number(c.req.param("divisionEditionId")), {
    token: c.req.header("x-bidding-token"),
    email: c.get("email"),
  });
}

const notFound = { error: "This bidding link is not valid, or you are not a reviewer for this division" };

export const biddingRoutes = router()
  .get("/:divisionEditionId", async (c) => {
    const b = await bidder(c);
    if (!b) return c.json(notFound, 404);
    const open = biddingOpen(b.divisionEdition);
    const list = open ? await biddingList(c.env, c.get("db"), b) : { basedOnOwnWork: false, submissions: [] };
    return c.json({
      conference: b.conference.name,
      division: b.division.name,
      edition: b.edition.name,
      email: b.email,
      deadline: b.divisionEdition.biddingDeadline,
      open,
      bids: await currentBids(c.get("db"), b.divisionEdition.id, b.reviewer.id),
      ...list,
    });
  })
  /** The abstract of a submission the reviewer may bid on */
  .get("/:divisionEditionId/submissions/:submissionId", async (c) => {
    const b = await bidder(c);
    if (!b) return c.json(notFound, 404);
    const submissionId = Number(c.req.param("submissionId"));
    const s = await c.get("db").query.submissions.findFirst({
      where: and(
        eq(submissions.id, submissionId),
        eq(submissions.editionId, b.edition.id),
        eq(submissions.divisionId, b.division.id),
      ),
    });
    if (!s) return c.json({ error: "Not found" }, 404);
    return c.json({ id: s.id, title: s.title, abstract: s.abstract });
  })
  /** The reviewer's bids, in order of preference (replaces earlier bids) */
  .put(
    "/:divisionEditionId/bids",
    zValidator("json", z.object({ submissionIds: z.array(z.number().int()).max(1000) })),
    async (c) => {
      const db = c.get("db");
      const b = await bidder(c);
      if (!b) return c.json(notFound, 404);
      if (!biddingOpen(b.divisionEdition)) return c.json({ error: "Bidding is closed" }, 403);
      const submissionIds = [...new Set(c.req.valid("json").submissionIds)];
      const allowed = new Set((await biddingList(c.env, db, b)).submissions.map((s) => s.id));
      if (submissionIds.some((id) => !allowed.has(id)))
        return c.json({ error: "You cannot bid on some of these submissions" }, 400);
      await db
        .insert(bids)
        .values({ divisionEditionId: b.divisionEdition.id, reviewerId: b.reviewer.id, submissionIds, updatedAt: new Date() })
        .onConflictDoUpdate({
          target: [bids.divisionEditionId, bids.reviewerId],
          set: { submissionIds, updatedAt: new Date() },
        });
      return c.json({ submissionIds });
    },
  );
