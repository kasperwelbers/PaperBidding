import Papa from "papaparse";
import type { FieldSpec } from "./adapter";

export interface Csv {
  headers: string[];
  rows: string[][];
}

/** Parses a CSV file (strips a UTF-8 BOM, skips empty rows) */
export function parseCsv(text: string): Csv {
  const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  const result = Papa.parse<string[]>(clean, { skipEmptyLines: "greedy" });
  const [headers = [], ...rows] = result.data;
  return { headers: headers.map((h) => h.trim()), rows };
}

/** Only the header row (for proposing a column mapping before importing) */
export function parseCsvHeaders(textStart: string): string[] {
  const clean = textStart.charCodeAt(0) === 0xfeff ? textStart.slice(1) : textStart;
  const result = Papa.parse<string[]>(clean, { preview: 1 });
  return (result.data[0] ?? []).map((h) => h.trim());
}

/** field -> header */
export type ColumnMapping = Record<string, string>;

/** Proposes a header for each field: an exact (case-insensitive) match on an
 *  alias first, otherwise the first header that contains an alias */
export function detectColumns(headers: string[], fields: FieldSpec[]): ColumnMapping {
  const lower = headers.map((h) => h.toLowerCase());
  const mapping: ColumnMapping = {};
  for (const field of fields) {
    const aliases = field.headerAliases.map((a) => a.toLowerCase());
    let i = lower.findIndex((h) => aliases.includes(h));
    if (i === -1) i = lower.findIndex((h) => aliases.some((a) => h.includes(a)));
    if (i !== -1) mapping[field.field] = headers[i]!;
  }
  return mapping;
}

/** Required fields that have no column */
export function missingFields(mapping: ColumnMapping, fields: FieldSpec[]) {
  return fields.filter((f) => f.required && !mapping[f.field]);
}

/** Rows as field -> value, using the mapping. Unmapped fields are left out */
export function applyMapping(csv: Csv, mapping: ColumnMapping): Record<string, string>[] {
  const index = Object.entries(mapping)
    .map(([field, header]) => [field, csv.headers.indexOf(header)] as const)
    .filter(([, i]) => i !== -1);
  return csv.rows.map((row) => {
    const obj: Record<string, string> = {};
    for (const [field, i] of index) obj[field] = (row[i] ?? "").trim();
    return obj;
  });
}
