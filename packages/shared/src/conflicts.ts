// Who may review whom. One function for the bidding page and for the
// matching, so they always agree. Works on person IDs and resolved
// institutions, not on emails and raw text. Only uses data from the
// conference itself.

export interface ConflictRules {
  /** co-authors in the current edition */
  coAuthorsCurrentEdition: boolean;
  /** co-authors in earlier editions of this conference */
  coAuthorsPreviousEditions: boolean;
  /** an author of the submission lists the reviewer's current institution */
  sameInstitution: boolean;
}

export const defaultConflictRules: ConflictRules = {
  coAuthorsCurrentEdition: true,
  coAuthorsPreviousEditions: true,
  sameInstitution: true,
};

export interface ConflictReviewer {
  personId: number;
  /** best guess of the current institution */
  institution: string | null;
  coAuthorsCurrentEdition: ReadonlySet<number>;
  coAuthorsPreviousEditions: ReadonlySet<number>;
}

export interface ConflictSubmission {
  /** the authors' institutions as listed on this submission */
  authors: { personId: number; institution: string | null }[];
}

export type ConflictReason = "own" | "coAuthor" | "coAuthorPrevious" | "institution";

const sameText = (a: string | null, b: string | null) =>
  // missing data is never a conflict
  !!a && !!b && a.trim().toLowerCase() === b.trim().toLowerCase();

/** Why a reviewer may not review a submission, or null if they may */
export function conflictReason(
  reviewer: ConflictReviewer,
  submission: ConflictSubmission,
  rules: ConflictRules,
): ConflictReason | null {
  const authors = submission.authors;
  if (authors.some((a) => a.personId === reviewer.personId)) return "own";
  if (rules.coAuthorsCurrentEdition && authors.some((a) => reviewer.coAuthorsCurrentEdition.has(a.personId)))
    return "coAuthor";
  if (
    rules.coAuthorsPreviousEditions &&
    authors.some((a) => reviewer.coAuthorsPreviousEditions.has(a.personId))
  )
    return "coAuthorPrevious";
  if (rules.sameInstitution && authors.some((a) => sameText(a.institution, reviewer.institution)))
    return "institution";
  return null;
}
