import type { Preset } from "@cp/shared";

/** How a conference uses ScholarOne. Copied from a preset into the
 *  conference settings, where an admin can edit it */
export interface ScholarOneSettings {
  /** site of an edition; "{year}" is replaced by the conference year
   *  (the year after the edition is created, since bidding happens in the fall) */
  siteUrlPattern: string;
  submissions: {
    /** saved search with the right display items, if the conference has one */
    savedSearch?: string;
    /** column with the division of a submission */
    divisionColumn: string;
  };
  reviewers: {
    /** saved search per division; "{division}" is replaced */
    savedSearch?: string;
    /** column with the expertise keywords */
    keywordsColumn: string;
    /** separates the division from the keyword, as in "Division: keyword" */
    keywordSeparator: string;
  };
}

export const icaPreset: Preset<ScholarOneSettings> = {
  id: "ica",
  name: "International Communication Association (ICA)",
  settings: {
    siteUrlPattern: "https://ica{year}.abstractcentral.com/",
    submissions: {
      savedSearch: "Paper Bidding (select division yourself)",
      divisionColumn: "CURRENT CATEGORY",
    },
    reviewers: {
      savedSearch: "{division} Reviewers",
      keywordsColumn: "PERSON (AREA OF EXPERTISE)",
      keywordSeparator: ":",
    },
  },
};

export const presets = [icaPreset];

export function siteUrl(settings: ScholarOneSettings, editionCreatedAt: Date) {
  return settings.siteUrlPattern.replace(
    "{year}",
    String(editionCreatedAt.getFullYear() + 1),
  );
}
