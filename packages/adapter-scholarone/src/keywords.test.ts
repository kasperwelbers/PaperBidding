import { describe, expect, it } from "vitest";
import {
  keywordDivisionPart,
  matchKeywordToDivision,
  splitKeywords,
} from "./keywords";
import { icaPreset, siteUrl } from "./settings";

const divisions = [
  { id: 1, name: "Computational Methods" },
  { id: 2, name: "Political Communication" },
];

describe("keywordDivisionPart", () => {
  it("takes the part before the separator", () => {
    expect(keywordDivisionPart("Computational Methods: content analysis")).toBe(
      "Computational Methods",
    );
    expect(keywordDivisionPart("Computational Methods")).toBe("Computational Methods");
  });
});

describe("matchKeywordToDivision", () => {
  it("matches the division alone and division: keyword", () => {
    expect(matchKeywordToDivision("Computational Methods", divisions)?.id).toBe(1);
    expect(
      matchKeywordToDivision("computational  methods: content analysis", divisions)?.id,
    ).toBe(1);
  });
  it("returns undefined for orphan keywords", () => {
    expect(matchKeywordToDivision("Health Communication: vaccines", divisions)).toBeUndefined();
  });
});

describe("splitKeywords", () => {
  it("splits on ; and new lines and drops empty values", () => {
    expect(splitKeywords("A: x; B\nC;; ")).toEqual(["A: x", "B", "C"]);
  });
});

describe("siteUrl", () => {
  it("uses the year after the edition was created", () => {
    expect(siteUrl(icaPreset.settings, new Date("2026-10-23"))).toBe(
      "https://ica2027.abstractcentral.com/",
    );
  });
});
