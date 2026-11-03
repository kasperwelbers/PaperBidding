import { applyMapping, detectColumns, parseCsv } from "@cp/shared";
import { describe, expect, it } from "vitest";
import { scholarOneAdapter } from "./adapter";
import { icaPreset } from "./settings";

const settings = scholarOneAdapter.resolveSettings(icaPreset.settings);

function rowsFor(kind: "submissions" | "persons" | "reviewers", text: string) {
  const spec = scholarOneAdapter.imports[kind];
  const csv = parseCsv(text);
  const mapping = detectColumns(csv.headers, spec.fields(settings));
  return { spec, mapping, rows: applyMapping(csv, mapping) };
}

describe("submissions import", () => {
  const text = [
    "CONTROL ID,TITLE,ABSTRACT BODY,AUTHOR (E-mail),INSTITUTIONS (ALL),CURRENT CATEGORY,SUBMITTER (EMAIL)",
    "100,Paper A,Abstract A,A@Uni.edu,Uni,Computational Methods,x@y",
    "100,Paper A,Abstract A,b@uni.edu,Uni2,Computational Methods,x@y",
    "101,Paper B,Abstract B,c@uni.edu,Uni,Political Communication,x@y",
  ].join("\n");

  it("detects the ICA columns, and not the submitter column for authors", () => {
    const { mapping } = rowsFor("submissions", text);
    expect(mapping).toMatchObject({
      externalId: "CONTROL ID",
      authorEmail: "AUTHOR (E-mail)",
      division: "CURRENT CATEGORY",
    });
  });

  it("groups author rows by Control ID", () => {
    const { spec, rows } = rowsFor("submissions", text);
    const { records } = spec.parse(rows, settings);
    expect(records).toHaveLength(2);
    expect(records[0]).toMatchObject({
      externalId: "100",
      divisionKey: "Computational Methods",
      authors: [
        { email: "a@uni.edu", institution: "Uni", position: 0 },
        { email: "b@uni.edu", institution: "Uni2", position: 1 },
      ],
    });
  });

  it("warns when the presenter or submitter column is used for authors", () => {
    const spec = scholarOneAdapter.imports.submissions;
    expect(spec.checkMapping!({ authorEmail: "SUBMITTER (EMAIL)" }, settings)).toHaveLength(1);
  });
});

describe("reviewers import", () => {
  const text = [
    "PERSON (ID),PERSON (EMAIL),PERSON (MEMBER ID),PERSON (AREA OF EXPERTISE),STUDENT,REVIEWER",
    "1,r@uni.edu,999,Computational Methods: content analysis,No,Yes",
    "1,r@uni.edu,999,Political Communication,No,Yes",
    "2,s@uni.edu,998,Computational Methods; Health Communication,Yes,No",
  ].join("\n");

  it("uses PERSON (ID), not PERSON (MEMBER ID)", () => {
    expect(rowsFor("reviewers", text).mapping.personId).toBe("PERSON (ID)");
  });

  it("merges rows per person and reads keywords and flags", () => {
    const { spec, rows } = rowsFor("reviewers", text);
    const { records } = spec.parse(rows, settings);
    expect(records).toEqual([
      {
        person: {
          personId: "1",
          emails: ["r@uni.edu"],
          keywords: ["Computational Methods: content analysis", "Political Communication"],
        },
        student: false,
        willingToReview: true,
        divisionKeys: [],
      },
      {
        person: {
          personId: "2",
          emails: ["s@uni.edu"],
          keywords: ["Computational Methods", "Health Communication"],
        },
        student: true,
        willingToReview: false,
        divisionKeys: [],
      },
    ]);
  });
});

describe("assignments export", () => {
  it("writes the ICA bulk upload format", () => {
    const rows = scholarOneAdapter.exports.assignments.rows(
      { assignments: [{ personId: "1", externalSubmissionId: "100" }] },
      settings,
    );
    expect(rows).toEqual([["Person ID", "Control ID"], ["1", "100"]]);
  });
});
