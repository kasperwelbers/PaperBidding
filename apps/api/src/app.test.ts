import { describe, expect, it } from "vitest";
import { app } from "./app";

// A minimal fake D1 binding: enough for the health check
function fakeD1(): D1Database {
  const stmt = {
    bind: () => stmt,
    raw: async () => [[1]],
    all: async () => ({ results: [{ ok: 1 }], success: true, meta: {} }),
    first: async () => ({ ok: 1 }),
    run: async () => ({ success: true, meta: {} }),
  };
  return { prepare: () => stmt } as unknown as D1Database;
}

describe("GET /api/health", () => {
  it("reports ok when the database answers", async () => {
    const res = await app.request("/api/health", {}, { DB: fakeD1() } as Env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, service: "conference-planner" });
  });
});
