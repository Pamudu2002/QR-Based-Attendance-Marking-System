const VERSIONS: Record<number, string> = {
  23: "6", 24: "7", 25: "7.1", 26: "8", 27: "8.1", 28: "9", 29: "10", 30: "11",
  31: "12", 32: "12L", 33: "13", 34: "14", 35: "15", 36: "16",
};

/** API level → marketing version, e.g. 34 → "Android 14". */
export function androidVersion(sdk: number): string {
  return `Android ${VERSIONS[sdk] ?? `API ${sdk}`}`;
}
