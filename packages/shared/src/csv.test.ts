import { describe, expect, it } from "vitest";
import { applyMapping, detectColumns, missingFields, parseCsv, parseCsvHeaders } from "./csv";

const fields = [
  { field: "id", label: "ID", headerAliases: ["control id"], required: true },
  { field: "title", label: "Title", headerAliases: ["title"], required: true },
  { field: "status", label: "Status", headerAliases: ["abstract status"], required: false },
];

describe("parseCsv", () => {
  it("strips the BOM, handles quoted newlines and skips empty rows", () => {
    const csv = parseCsv('﻿CONTROL ID,TITLE\n1,"a\nb"\n\n2,c\n');
    expect(csv.headers).toEqual(["CONTROL ID", "TITLE"]);
    expect(csv.rows).toEqual([["1", "a\nb"], ["2", "c"]]);
  });
  it("reads only the headers from the start of a file", () => {
    expect(parseCsvHeaders('﻿A,"B, C",D\n1,2')).toEqual(["A", "B, C", "D"]);
  });
});

describe("detectColumns", () => {
  it("prefers exact matches over partial ones", () => {
    const mapping = detectColumns(["PRESENTATION TITLE", "TITLE", "CONTROL ID"], fields);
    expect(mapping).toEqual({ id: "CONTROL ID", title: "TITLE" });
  });
  it("falls back to headers that contain an alias", () => {
    expect(detectColumns(["SESSION TITLE"], fields)).toEqual({ title: "SESSION TITLE" });
  });
  it("reports required fields without a column", () => {
    const mapping = detectColumns(["TITLE"], fields);
    expect(missingFields(mapping, fields).map((f) => f.field)).toEqual(["id"]);
  });
});

describe("applyMapping", () => {
  it("returns rows keyed by field", () => {
    const csv = parseCsv("CONTROL ID,TITLE,X\n1, A ,y\n");
    expect(applyMapping(csv, { id: "CONTROL ID", title: "TITLE" })).toEqual([{ id: "1", title: "A" }]);
  });
});
