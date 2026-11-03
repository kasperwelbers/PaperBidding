import { zValidator } from "@hono/zod-validator";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { blobToEmbedding, rankBySimilarity } from "@cp/shared";
import { conferences, divisions, submissions } from "@cp/db";
import { router } from "../context";
import { getEmbedder } from "../embeddings";
import { enqueue, needsEmbedding } from "../imports/process";
import { requireConferenceAdmin } from "./shared";

/** Embeddings of an edition: progress, and computing them again */
export const embeddingRoutes = router()
  .get("/", async (c) => {
    const db = c.get("db");
    const editionId = c.get("editionId");
    const conference = await db.query.conferences.findFirst({ where: eq(conferences.id, c.get("conferenceId")) });
    const model = getEmbedder(c.env, conference?.embeddingLanguage).model;
    const [total] = await db
      .select({ n: sql<number>`count(*)` })
      .from(submissions)
      .where(eq(submissions.editionId, editionId));
    const [pending] = await db
      .select({ n: sql<number>`count(*)` })
      .from(submissions)
      .where(needsEmbedding(editionId, model));
    return c.json({ model, total: total?.n ?? 0, pending: pending?.n ?? 0 });
  })
  /** Compute missing or outdated embeddings (e.g. after the model changed) */
  .post("/", requireConferenceAdmin, async (c) => {
    await enqueue(c.env, { step: "embed", editionId: c.get("editionId") });
    return c.json({ queued: true });
  });

/** Submissions of an edition */
export const submissionRoutes = router()
  /** The most similar submissions in the edition (same embedding model), e.g.
   *  to check that the embeddings make sense */
  .get(
    "/:submissionId/similar",
    zValidator("query", z.object({ limit: z.coerce.number().int().min(1).max(50).default(10) })),
    async (c) => {
      const db = c.get("db");
      const editionId = c.get("editionId");
      const submissionId = Number(c.req.param("submissionId"));
      const target = await db.query.submissions.findFirst({
        where: and(eq(submissions.id, submissionId), eq(submissions.editionId, editionId)),
      });
      if (!target) return c.json({ error: "Not found" }, 404);
      if (!target.embedding || !target.embeddingModel)
        return c.json({ error: "This submission has no embedding yet" }, 409);

      const others = await db
        .select({
          id: submissions.id,
          externalId: submissions.externalId,
          title: submissions.title,
          division: divisions.name,
          embedding: submissions.embedding,
        })
        .from(submissions)
        .leftJoin(divisions, eq(divisions.id, submissions.divisionId))
        .where(
          and(
            eq(submissions.editionId, editionId),
            eq(submissions.embeddingModel, target.embeddingModel),
            isNotNull(submissions.embedding),
          ),
        );
      const ranked = rankBySimilarity(
        others
          .filter((s) => s.id !== target.id)
          .map((s) => ({ ...s, embedding: blobToEmbedding(s.embedding as Uint8Array) })),
        [blobToEmbedding(target.embedding as Uint8Array)],
      );
      return c.json(
        ranked.slice(0, c.req.valid("query").limit).map(({ embedding, ...s }) => ({
          ...s,
          similarity: Math.round(s.similarity * 1000) / 1000,
        })),
      );
    },
  );
