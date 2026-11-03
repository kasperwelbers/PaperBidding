import type { PlatformAdapter } from "@cp/shared";
import { personsImport, reviewersImport, submissionsImport } from "./imports";
import { icaPreset, presets, siteUrl, type ScholarOneSettings } from "./settings";

/** Defaults for settings that a conference did not set (generic ScholarOne) */
const defaults: ScholarOneSettings = {
  siteUrlPattern: icaPreset.settings.siteUrlPattern,
  submissions: { divisionColumn: "CURRENT CATEGORY" },
  reviewers: { keywordsColumn: "PERSON (AREA OF EXPERTISE)", keywordSeparator: ":" },
};

function resolveSettings(raw: unknown): ScholarOneSettings {
  const s = (raw ?? {}) as Partial<ScholarOneSettings>;
  return {
    siteUrlPattern: s.siteUrlPattern || defaults.siteUrlPattern,
    submissions: { ...defaults.submissions, ...s.submissions },
    reviewers: { ...defaults.reviewers, ...s.reviewers },
  };
}

export const scholarOneAdapter: PlatformAdapter<ScholarOneSettings> = {
  id: "scholarone",
  name: "ScholarOne Abstracts",
  presets,
  resolveSettings,
  links: (edition, settings) => {
    const site = siteUrl(settings, edition.createdAt);
    return { site, registration: site };
  },
  imports: {
    submissions: submissionsImport,
    persons: personsImport,
    reviewers: reviewersImport,
  },
  exports: {
    // the ICA bulk reviewer assignment upload (see the legacy Step 6)
    assignments: {
      filename: () => "reviewer_assignments.csv",
      bom: true,
      instructions: () => [
        { text: "Upload this file in ScholarOne with the bulk reviewer assignment upload" },
      ],
      rows: (input) => [
        ["Person ID", "Control ID"],
        ...input.assignments.map((a) => [a.personId, a.externalSubmissionId]),
      ],
    },
  },
};
