// Normalized records. Platform adapters parse their files into these, so the
// rest of the app does not depend on the platform.

export interface AuthorRecord {
  email: string;
  institution: string;
  /** 0 = first author */
  position: number;
  /** platform person ID, if the export includes it */
  personId?: string;
}

export interface SubmissionRecord {
  /** e.g. the ScholarOne Control ID */
  externalId: string;
  title: string;
  abstract: string;
  /** platform value that identifies the division (e.g. CURRENT CATEGORY) */
  divisionKey?: string;
  status?: string;
  authors: AuthorRecord[];
}

export interface PersonRecord {
  /** platform person ID (e.g. ScholarOne PERSON (ID)) */
  personId?: string;
  emails: string[];
  name?: string;
  institution?: string;
  /** expertise keywords, as in the platform */
  keywords: string[];
}

export interface ReviewerRecord {
  person: PersonRecord;
  student: boolean;
  willingToReview: boolean;
  /** platform values that identify divisions, if the export has them */
  divisionKeys: string[];
}
