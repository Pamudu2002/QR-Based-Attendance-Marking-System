// Index numbers, names and module display names (docs/PLAN.md §4.3, §6.1).

export const INDEX_RE = /^\d{6}[A-Z]$/;

export function normaliseIndex(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidIndex(raw: string): boolean {
  return INDEX_RE.test(normaliseIndex(raw));
}

/** Upper-case, then keep only letters and digits. "Lokuhewa P. C." → "LOKUHEWAPC". */
export function nameKey(name: string): string {
  return name.toUpperCase().replace(/[^\p{L}\p{N}]/gu, "");
}

export function namesMatch(a: string, b: string): boolean {
  return nameKey(a) === nameKey(b);
}

/** Tidies spacing but keeps the lecturer's spelling and capitals. */
export function cleanName(name: string): string {
  return name.trim().replace(/\s+/g, " ");
}

export type ModuleKey = { intake: string; semester: string; code: string };

/** "22", "In22" or "in22" → "In22". Null unless it's two digits after the optional "In". */
export function normaliseIntake(raw: string): string | null {
  const m = raw.trim().match(/^(?:in)?\s*(\d{2})$/i);
  return m ? `In${m[1]}` : null;
}

/** "7", "S7" or "s7" → "S7". Null if it isn't 1–2 digits after the optional "S". */
export function normaliseSemester(raw: string): string | null {
  const m = raw.trim().match(/^s?\s*(\d{1,2})$/i);
  return m ? `S${m[1]}` : null;
}

export function moduleShortName(m: ModuleKey): string {
  return `${m.intake}-${m.semester}-${m.code}`;
}

/** Moodle-style name: "In22-S7-CS4473 - Mobile Computing". */
export function moduleDisplayName(m: ModuleKey & { name: string }): string {
  return `${moduleShortName(m)} - ${m.name}`;
}
