// Expertise keywords look like "Computational Methods" (the division alone) or
// "Computational Methods: content analysis" (division: keyword). Keywords are
// matched to divisions by name. Unmatched ("orphan") keywords are shown to the
// conference admin, who assigns them by hand.

function normalize(s: string) {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}

/** The division part of a keyword ("Computational Methods: content analysis"
 *  -> "Computational Methods") */
export function keywordDivisionPart(keyword: string, separator = ":") {
  const i = keyword.indexOf(separator);
  return (i === -1 ? keyword : keyword.slice(0, i)).trim();
}

/** The division a keyword belongs to, matched on name (case and whitespace
 *  insensitive), or undefined for an orphan keyword */
export function matchKeywordToDivision<D extends { name: string }>(
  keyword: string,
  divisions: D[],
  separator = ":",
): D | undefined {
  const part = normalize(keywordDivisionPart(keyword, separator));
  return divisions.find((d) => normalize(d.name) === part);
}

/** Split a cell with several keywords. ScholarOne separates them with ";" or
 *  new lines */
export function splitKeywords(cell: string): string[] {
  return cell
    .split(/[;\n]/)
    .map((k) => k.trim())
    .filter(Boolean);
}
