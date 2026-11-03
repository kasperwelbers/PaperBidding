import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { app } from "../src/app";
import { signIn } from "./helpers";

type Json = any;
const json = async (res: Response) => (await res.json()) as Json;

/** A superadmin who added `admin@example.com` as admin, and that admin with a
 *  new ICA conference */
async function conferenceSetup() {
  const superadmin = await signIn("super@example.com");
  await superadmin("/api/admins", { method: "POST", body: { email: "Admin@Example.com" } });
  const admin = await signIn("admin@example.com");
  const res = await admin("/api/conferences", {
    method: "POST",
    body: { name: "ICA", platform: "scholarone", preset: "ica" },
  });
  expect(res.status).toBe(201);
  const conference = await json(res);
  return { superadmin, admin, conference, base: `/api/conferences/${conference.id}` };
}

describe("health and auth", () => {
  it("reports the database is reachable", async () => {
    const res = await app.request("/api/health", {}, env);
    expect(await res.json()).toEqual({ ok: true, service: "conference-planner" });
  });

  it("requires signing in", async () => {
    const res = await app.request("/api/me", {}, env);
    expect(res.status).toBe(401);
  });

  it("signs in with an email code", async () => {
    const user = await signIn("someone@example.com");
    const me = await json(await user("/api/me"));
    expect(me).toEqual({ email: "someone@example.com", isSuperadmin: false, isAdmin: false });
  });
});

describe("admins", () => {
  it("can only be managed by superadmins", async () => {
    const user = await signIn("someone@example.com");
    expect((await user("/api/admins")).status).toBe(403);

    const superadmin = await signIn("super@example.com");
    await superadmin("/api/admins", { method: "POST", body: { email: "New@Example.com" } });
    const list = await json(await superadmin("/api/admins"));
    expect(list.map((a: Json) => a.email)).toEqual(["new@example.com"]);
  });

  it("only admins can create conferences", async () => {
    const user = await signIn("someone@example.com");
    const res = await user("/api/conferences", {
      method: "POST",
      body: { name: "X", platform: "scholarone" },
    });
    expect(res.status).toBe(403);
  });
});

describe("conferences", () => {
  it("copies the preset settings and makes the creator conference admin", async () => {
    const { admin, conference, base } = await conferenceSetup();
    expect(conference.settings.submissions.divisionColumn).toBe("CURRENT CATEGORY");

    const detail = await json(await admin(base));
    expect(detail.role).toBe("admin");
    const users = await json(await admin(`${base}/users`));
    expect(users).toEqual([
      { id: expect.any(Number), email: "admin@example.com", role: "admin", divisionIds: [] },
    ]);
  });

  it("is invisible to people without a role", async () => {
    const { base } = await conferenceSetup();
    const outsider = await signIn("outsider@example.com");
    expect((await outsider(base)).status).toBe(404);
    expect((await outsider(`${base}/divisions`)).status).toBe(404);
    expect(await json(await outsider("/api/conferences"))).toEqual([]);
  });

  it("lets planners view everything but not edit", async () => {
    const { admin, base } = await conferenceSetup();
    const division = await json(
      await admin(`${base}/divisions`, { method: "POST", body: { name: "Computational Methods" } }),
    );
    expect(division.platformKey).toBe("Computational Methods");
    await admin(`${base}/users`, {
      method: "POST",
      body: { email: "planner@example.com", role: "planner", divisionIds: [division.id] },
    });

    const planner = await signIn("planner@example.com");
    expect((await json(await planner(base))).role).toBe("planner");
    expect((await json(await planner(`${base}/divisions`))).length).toBe(1);
    const users = await json(await planner(`${base}/users`));
    expect(users.find((u: Json) => u.email === "planner@example.com").divisionIds).toEqual([
      division.id,
    ]);

    const create = await planner(`${base}/divisions`, { method: "POST", body: { name: "Other" } });
    expect(create.status).toBe(403);
    const edition = await planner(`${base}/editions`, { method: "POST", body: { name: "2027" } });
    expect(edition.status).toBe(403);
  });

  it("rejects duplicate division names and unknown divisions", async () => {
    const { admin, base } = await conferenceSetup();
    await admin(`${base}/divisions`, { method: "POST", body: { name: "Health" } });
    const dup = await admin(`${base}/divisions`, { method: "POST", body: { name: "Health" } });
    expect(dup.status).toBe(409);

    const res = await admin(`${base}/users`, {
      method: "POST",
      body: { email: "p@example.com", role: "planner", divisionIds: [999] },
    });
    expect(res.status).toBe(400);
  });

  it("keeps at least one conference admin", async () => {
    const { admin, base } = await conferenceSetup();
    const [me] = await json(await admin(`${base}/users`));
    const demote = await admin(`${base}/users/${me.id}`, {
      method: "PATCH",
      body: { role: "planner" },
    });
    expect(demote.status).toBe(400);
    expect((await admin(`${base}/users/${me.id}`, { method: "DELETE" })).status).toBe(400);
  });

  it("manages editions and planner divisions", async () => {
    const { admin, base } = await conferenceSetup();
    const edition = await json(
      await admin(`${base}/editions`, { method: "POST", body: { name: "ICA 2027" } }),
    );
    expect(edition.name).toBe("ICA 2027");
    expect((await json(await admin(`${base}/editions`))).length).toBe(1);

    const a = await json(await admin(`${base}/divisions`, { method: "POST", body: { name: "A" } }));
    const b = await json(await admin(`${base}/divisions`, { method: "POST", body: { name: "B" } }));
    const planner = await json(
      await admin(`${base}/users`, {
        method: "POST",
        body: { email: "p@example.com", role: "planner", divisionIds: [a.id] },
      }),
    );
    await admin(`${base}/users/${planner.id}`, { method: "PATCH", body: { divisionIds: [b.id] } });
    const users = await json(await admin(`${base}/users`));
    expect(users.find((u: Json) => u.id === planner.id).divisionIds).toEqual([b.id]);
  });
});
