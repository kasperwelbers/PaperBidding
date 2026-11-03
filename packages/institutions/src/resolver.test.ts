import { describe, expect, it } from "vitest";
import { institutionResolver, searchUniversities } from "./index";
import { normalizeInstitution } from "./resolver";

const resolver = institutionResolver();

describe("institution resolver (bundled Hipo list)", () => {
  it("resolves by email domain, including subdomains", () => {
    const vu = resolver.resolve({ email: "someone@vu.nl" });
    expect(vu.via).toBe("domain");
    expect(vu.name).toMatch(/Vrije Universiteit/);
    expect(resolver.resolve({ email: "x@student.vu.nl" }).name).toBe(vu.name);
  });

  it("never uses webmail domains", () => {
    expect(resolver.resolve({ email: "a@gmail.com" })).toEqual({ name: null, via: "none" });
  });

  it("falls back to the name, preferring the most specific match", () => {
    const r = resolver.resolve({ email: "a@gmail.com", raw: "Dept. of Communication, Univ of Amsterdam" });
    // "Univ" isn't "university", so this is a raw fallback; with "Uni" it matches
    expect(r.via).toBe("raw");
    const m = resolver.resolve({ raw: "Communication Science, University of Amsterdam, Netherlands" });
    expect(m).toMatchObject({ via: "name", name: "University of Amsterdam" });
  });

  it("uses aliases first", () => {
    const aliases = new Map([[normalizeInstitution("ASCoR, UvA"), "University of Amsterdam"]]);
    const r = institutionResolver().resolve({ email: "x@vu.nl", raw: "ASCoR,  UvA" }, aliases);
    expect(r).toEqual({ name: "University of Amsterdam", via: "alias" });
  });

  it("keeps unknown institutions as written", () => {
    expect(resolver.resolve({ raw: " Some Research Lab " })).toEqual({ name: "Some Research Lab", via: "raw" });
  });

  it("finds universities by name", () => {
    expect(searchUniversities("amsterdam univ").map((u) => u.name)).toContain("University of Amsterdam");
  });
});
