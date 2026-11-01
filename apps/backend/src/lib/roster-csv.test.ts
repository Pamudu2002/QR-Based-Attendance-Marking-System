import { describe, expect, it } from "vitest";
import { classifyRows, MAX_IMPORT_ROWS, parseRosterCsv } from "./roster-csv";

describe("parseRosterCsv", () => {
  it("reads the template and validates each row", () => {
    const csv = [
      "index_number,name",
      "220366x,Lokuhewa P. C.",
      "22O512P,Jayasinghe R. T.",
      "220444M,",
      "220366X,Someone Else",
      "220720E,  Wijesinghe   L. A. V. B. ",
    ].join("\n");
    const res = parseRosterCsv(csv);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.format).toBe("template");
    expect(res.rows).toEqual([
      { row: 2, indexNumber: "220366X", name: "Lokuhewa P. C." },
      { row: 3, indexNumber: "22O512P", name: "Jayasinghe R. T.", error: "Index must be 6 digits and a letter" },
      { row: 4, indexNumber: "220444M", name: "", error: "Name is empty" },
      { row: 5, indexNumber: "220366X", name: "Someone Else", error: "Same index as row 2" },
      { row: 6, indexNumber: "220720E", name: "Wijesinghe L. A. V. B." },
    ]);
  });

  it("maps a Moodle participants export", () => {
    const csv = '\uFEFFFirst name,Last name,ID number,Email address\nPamudu,Lokuhewa,220366X,a@uom.lk\n';
    const res = parseRosterCsv(csv);
    expect(res.ok && res.format).toBe("moodle");
    expect(res.ok && res.rows[0]).toEqual({ row: 2, indexNumber: "220366X", name: "Pamudu Lokuhewa" });
  });

  it("accepts a file without a header", () => {
    const res = parseRosterCsv("220366X,Lokuhewa P. C.\n220720E,Wijesinghe L. A. V. B.\n");
    expect(res.ok && res.format).toBe("no-header");
    expect(res.ok && res.rows.map((r) => r.row)).toEqual([1, 2]);
  });

  it("rejects files it can't map or that are too long", () => {
    expect(parseRosterCsv("")).toEqual({ ok: false, error: "The file is empty." });
    expect(parseRosterCsv("foo,bar\n1,2").ok).toBe(false);
    const big = ["index_number,name", ...Array.from({ length: MAX_IMPORT_ROWS + 1 }, (_, i) => `${String(i).padStart(6, "0")}A,N`)];
    expect(parseRosterCsv(big.join("\n")).ok).toBe(false);
  });
});

describe("classifyRows", () => {
  it("splits rows into new, unchanged, name differs and errors", () => {
    const roster = new Map([
      ["220366X", "LOKUHEWA P.C."],
      ["220245K", "Fernando S. M."],
    ]);
    const res = parseRosterCsv("index_number,name\n220366X,Lokuhewa P. C.\n220245K,Fernando S. M. N.\n220720E,Wijesinghe\nbad,x\n");
    if (!res.ok) throw new Error("parse failed");
    expect(classifyRows(res.rows, roster).map((r) => [r.indexNumber, r.result, r.rosterName])).toEqual([
      ["220366X", "unchanged", "LOKUHEWA P.C."],
      ["220245K", "name_differs", "Fernando S. M."],
      ["220720E", "new", undefined],
      ["BAD", "error", undefined],
    ]);
  });
});
