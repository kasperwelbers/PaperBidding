import { describe, expect, it } from "vitest";
import { conflictReason, defaultConflictRules, type ConflictReviewer } from "./conflicts";

const reviewer: ConflictReviewer = {
  personId: 1,
  institution: "University of Amsterdam",
  coAuthorsCurrentEdition: new Set([2]),
  coAuthorsPreviousEditions: new Set([3]),
};
const by = (personId: number, institution: string | null = "Elsewhere") => ({
  authors: [{ personId, institution }],
});

describe("conflictReason", () => {
  it("never allows reviewing your own submission", () => {
    const rules = { coAuthorsCurrentEdition: false, coAuthorsPreviousEditions: false, sameInstitution: false };
    expect(conflictReason(reviewer, by(1), rules)).toBe("own");
  });

  it("applies the co-author and institution rules", () => {
    expect(conflictReason(reviewer, by(2), defaultConflictRules)).toBe("coAuthor");
    expect(conflictReason(reviewer, by(3), defaultConflictRules)).toBe("coAuthorPrevious");
    expect(conflictReason(reviewer, by(4, "university of amsterdam"), defaultConflictRules)).toBe("institution");
    expect(conflictReason(reviewer, by(4), defaultConflictRules)).toBeNull();
  });

  it("can switch rules off", () => {
    const rules = { ...defaultConflictRules, coAuthorsPreviousEditions: false, sameInstitution: false };
    expect(conflictReason(reviewer, by(3), rules)).toBeNull();
    expect(conflictReason(reviewer, by(4, "University of Amsterdam"), rules)).toBeNull();
  });

  it("does not treat missing institutions as the same institution", () => {
    const noInstitution = { ...reviewer, institution: null };
    expect(conflictReason(noInstitution, by(4, null), defaultConflictRules)).toBeNull();
    expect(conflictReason(reviewer, by(4, null), defaultConflictRules)).toBeNull();
  });
});
