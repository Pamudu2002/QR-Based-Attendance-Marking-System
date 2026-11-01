// CSV roster parsing and validation (docs/PLAN.md §4.2). Pure: no database.
import Papa from "papaparse";
import { cleanName, INDEX_RE, nameKey, normaliseIndex } from "./identity";

export const MAX_IMPORT_ROWS = 1000;

export type ParsedRow = {
  /** Line in the file; the header is line 1. */
  row: number;
  indexNumber: string;
  name: string;
  error?: string;
};

export type ParsedCsv =
  | { ok: true; format: "template" | "moodle" | "no-header"; rows: ParsedRow[] }
  | { ok: false; error: string };

const INDEX_HEADERS = ["index_number", "index number", "index", "index no", "index no.", "indexnumber", "id number", "idnumber"];
const NAME_HEADERS = ["name", "full name", "fullname", "student name"];
const FIRST_HEADERS = ["first name", "firstname"];
const LAST_HEADERS = ["last name", "lastname", "surname"];

function find(headers: string[], options: string[]) {
  return headers.findIndex((h) => options.includes(h));
}

export function parseRosterCsv(text: string): ParsedCsv {
  const parsed = Papa.parse<string[]>(text.replace(/^\uFEFF/, ""), { skipEmptyLines: "greedy" });
  const lines = parsed.data.map((cells) => cells.map((c) => (c ?? "").trim()));
  if (lines.length === 0) return { ok: false, error: "The file is empty." };

  const headers = lines[0]!.map((h) => h.toLowerCase());
  let idx = find(headers, INDEX_HEADERS);
  let nameCol = find(headers, NAME_HEADERS);
  const first = find(headers, FIRST_HEADERS);
  const last = find(headers, LAST_HEADERS);

  let format: "template" | "moodle" | "no-header" = "template";
  let start = 1;
  if (idx < 0) {
    // No recognisable header: accept "index,name" rows if the first one looks like data.
    if (lines[0]!.length >= 2 && INDEX_RE.test(normaliseIndex(lines[0]![0]!))) {
      idx = 0;
      nameCol = 1;
      start = 0;
      format = "no-header";
    } else {
      return { ok: false, error: "Couldn't find an index number column. Use the template: index_number,name." };
    }
  } else if (nameCol < 0) {
    if (first < 0 && last < 0) {
      return { ok: false, error: "Couldn't find a name column. Use the template: index_number,name." };
    }
    format = "moodle";
  }

  const dataLines = lines.slice(start);
  if (dataLines.length > MAX_IMPORT_ROWS) {
    return { ok: false, error: `The file has ${dataLines.length} rows. The limit is ${MAX_IMPORT_ROWS}.` };
  }

  const seen = new Map<string, number>();
  const rows = dataLines.map((cells, i): ParsedRow => {
    const row = start + i + 1;
    const indexNumber = normaliseIndex(cells[idx] ?? "");
    const name = cleanName(
      nameCol >= 0 ? (cells[nameCol] ?? "") : [cells[first] ?? "", cells[last] ?? ""].join(" "),
    );

    let error: string | undefined;
    if (!INDEX_RE.test(indexNumber)) error = "Index must be 6 digits and a letter";
    else if (!nameKey(name)) error = "Name is empty";
    else if (seen.has(indexNumber)) error = `Same index as row ${seen.get(indexNumber)}`;
    if (!error) seen.set(indexNumber, row);

    return { row, indexNumber, name, ...(error ? { error } : {}) };
  });

  return { ok: true, format, rows };
}

export type RowResult = "new" | "unchanged" | "name_differs" | "error";

export type PreviewRow = ParsedRow & { result: RowResult; rosterName?: string };

/** Compares parsed rows with the current roster (index → roster name). */
export function classifyRows(rows: ParsedRow[], roster: Map<string, string>): PreviewRow[] {
  return rows.map((r) => {
    if (r.error) return { ...r, result: "error" };
    const rosterName = roster.get(r.indexNumber);
    if (rosterName === undefined) return { ...r, result: "new" };
    return nameKey(rosterName) === nameKey(r.name)
      ? { ...r, result: "unchanged", rosterName }
      : { ...r, result: "name_differs", rosterName };
  });
}
