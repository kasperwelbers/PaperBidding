import { env } from "cloudflare:workers";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { conflictReason, defaultConflictRules } from "@cp/shared";
import { createDb, editions, personIdentifiers, submissionAuthors, submissions } from "@cp/db";
import { drainTestQueue } from "../src/imports/process";
import { loadConflictReviewers, loadConflictSubmissions } from "../src/review-conflicts";
import { signIn } from "./helpers";

const json = async (res: Response) => (await res.json()) as any;
const header = "CONTROL ID,TITLE,ABSTRACT BODY,AUTHOR (E-mail),INSTITUTIONS (ALL),CURRENT CATEGORY";

async function setup() {
  const admin = await signIn("super@example.com");
  const conference = await json(
    await admin("/api/conferences", { method: "POST", body: { name: "ICA", platform: "scholarone", preset: "ica" } }),
  );
  const base = `/api/conferences/${conference.id}`;
  const edition = async (name: string) =>
    (await json(await admin(`${base}/editions`, { method: "POST", body: { name } }))).id as number;

  async function importSubmissions(editionId: number, rows: string[]) {
    const editionBase = `${base}/editions/${editionId}`;
    const { job } = await json(
      await admin(`${editionBase}/imports?kind=submissions&filename=s.csv`, { file: [header, ...rows].join("\n") }),
    );
    await admin(`${editionBase}/imports/${job.id}/start`, { method: "POST", body: { mapping: job.mapping } });
    await drainTestQueue(env);
  }
  return { admin, base, conferenceId: conference.id as number, edition, importSubmissions };
}

describe("institutions", () => {
  it("resolves institutions on import, and lists unresolved names", async () => {
    const { admin, base, edition, importSubmissions } = await setup();
    const e = await edition("ICA 2027");
    await importSubmissions(e, [
      `1,T,A,someone@student.uva.nl,"Dept. X, Somewhere",`,
      `2,T,A,a@gmail.com,"Some Research Lab",`,
      `3,T,A,b@gmail.com,"Communication Science, University of Amsterdam",`,
    ]);
    const db = createDb(env.DB);
    // storage is shared between tests in a file: only this edition
    const authorsOf = () =>
      db
        .select({ institution: submissionAuthors.institution, institutionRaw: submissionAuthors.institutionRaw })
        .from(submissionAuthors)
        .innerJoin(submissions, eq(submissions.id, submissionAuthors.submissionId))
        .where(eq(submissions.editionId, e));
    const rows = await authorsOf();
    const byRaw = Object.fromEntries(rows.map((r) => [r.institutionRaw, r.institution]));
    expect(byRaw["Dept. X, Somewhere"]).toBe("University of Amsterdam"); // email domain wins
    expect(byRaw["Some Research Lab"]).toBe("Some Research Lab");
    expect(byRaw["Communication Science, University of Amsterdam"]).toBe("University of Amsterdam");

    const unresolved = await json(await admin(`${base}/institutions/unresolved`));
    expect(unresolved).toEqual([{ name: "Some Research Lab", count: 2 }]); // author + person

    await admin(`${base}/institutions/aliases`, {
      method: "PUT",
      body: { text: "Some Research Lab", institution: "University of Amsterdam" },
    });
    expect(await json(await admin(`${base}/institutions/unresolved`))).toEqual([]);
    const after = await authorsOf();
    expect(after.every((r) => r.institution === "University of Amsterdam")).toBe(true);
  });

  it("finds universities by name", async () => {
    const { admin } = await setup();
    const found = await json(await admin("/api/institutions/search?q=amsterdam"));
    expect(found.map((u: any) => u.name)).toContain("University of Amsterdam");
  });
});

describe("review conflicts", () => {
  it("uses own submissions, co-authors in this and earlier editions, and institution", async () => {
    const { admin, base, conferenceId, edition, importSubmissions } = await setup();
    const previous = await edition("ICA 2026");
    await importSubmissions(previous, [`900,T,A,reviewer@uva.nl,,`, `900,T,A,old@x.org,,`]);
    const current = await edition("ICA 2027");
    await importSubmissions(current, [
      `1,T,A,reviewer@uva.nl,,`,
      `1,T,A,co@x.org,,`,
      `2,T,A,co@x.org,,`,
      `3,T,A,old@x.org,,`,
      `4,T,A,someone@uva.nl,,`,
      `5,T,A,stranger@x.org,,`,
    ]);

    const db = createDb(env.DB);
    const reviewer = await db.query.personIdentifiers.findFirst({
      where: and(eq(personIdentifiers.conferenceId, conferenceId), eq(personIdentifiers.value, "reviewer@uva.nl")),
    });
    const edition2027 = (await db.query.editions.findFirst({ where: eq(editions.id, current) }))!;
    const reviewers = await loadConflictReviewers(db, edition2027, [reviewer!.personId]);
    const r = reviewers.get(reviewer!.personId)!;
    expect(r.institution).toBe("University of Amsterdam");

    const subs = await db.query.submissions.findMany({ where: eq(submissions.editionId, current) });
    const data = await loadConflictSubmissions(db, subs.map((s) => s.id));
    const reasons = (rules = defaultConflictRules) =>
      Object.fromEntries(subs.map((s) => [s.externalId, conflictReason(r, data.get(s.id)!, rules)]));

    expect(reasons()).toEqual({
      "1": "own",
      "2": "coAuthor",
      "3": "coAuthorPrevious",
      "4": "institution",
      "5": null,
    });
    expect(
      reasons({ coAuthorsCurrentEdition: true, coAuthorsPreviousEditions: false, sameInstitution: false }),
    ).toEqual({ "1": "own", "2": "coAuthor", "3": null, "4": null, "5": null });

    // the rules are a conference setting
    await admin(base, {
      method: "PATCH",
      body: { conflictRules: { coAuthorsCurrentEdition: true, coAuthorsPreviousEditions: false, sameInstitution: true } },
    });
    expect((await json(await admin(base))).conflictRules.coAuthorsPreviousEditions).toBe(false);
  });
});
