import type {
  PersonRecord,
  ReviewerRecord,
  SubmissionRecord,
} from "./records";

/** One instruction step, rendered by the UI. Text may contain **bold** */
export interface InstructionStep {
  text: string;
  /** optional emphasis, e.g. for steps that are easy to get wrong */
  warning?: string;
}

/** A column that an import needs */
export interface FieldSpec {
  field: string;
  label: string;
  /** header names that are picked automatically (case-insensitive) */
  headerAliases: string[];
  required: boolean;
}

export interface ParseResult<T> {
  records: T[];
  warnings: string[];
}

export interface ImportSpec<T, Settings> {
  label: string;
  instructions(settings: Settings): InstructionStep[];
  fields(settings: Settings): FieldSpec[];
  /** problems with the chosen columns (e.g. a wrong column for a field) */
  checkMapping?(mapping: Record<string, string>, settings: Settings): string[];
  /** rows are keyed by field (see applyMapping) */
  parse(rows: Record<string, string>[], settings: Settings): ParseResult<T>;
}

export interface ExportSpec<Input, Settings> {
  filename(settings: Settings): string;
  /** UTF-8 BOM in front of the file */
  bom: boolean;
  instructions(settings: Settings): InstructionStep[];
  /** rows of the export file, including the header row */
  rows(input: Input, settings: Settings): string[][];
}

/** A matched assignment, as input for an assignments export */
export interface AssignmentExportInput {
  assignments: { personId: string; externalSubmissionId: string }[];
}

/** How one conference uses a platform (e.g. ICA on ScholarOne). Its values
 *  are copied into the conference settings, where they can be edited */
export interface Preset<Settings> {
  id: string;
  name: string;
  settings: Settings;
}

export interface EditionLinks {
  site: string;
  registration: string;
}

export type ImportKind = "submissions" | "persons" | "reviewers";

export interface PlatformAdapter<Settings> {
  id: string;
  name: string;
  presets: Preset<Settings>[];
  /** the conference settings with defaults filled in */
  resolveSettings(raw: unknown): Settings;
  links(edition: { name: string; createdAt: Date }, settings: Settings): EditionLinks;
  imports: {
    submissions: ImportSpec<SubmissionRecord, Settings>;
    persons: ImportSpec<PersonRecord, Settings>;
    reviewers: ImportSpec<ReviewerRecord, Settings>;
  };
  exports: {
    assignments: ExportSpec<AssignmentExportInput, Settings>;
  };
}
