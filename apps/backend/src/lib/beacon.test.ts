import { describe, expect, it } from "vitest";
import { beaconKey, beaconSeqAt, checkBeacons, makeBeaconPayload } from "./beacon";

// Shared with the Android test (BeaconCodeTest): both sides must produce these bytes.
const SECRET = "test-window-secret";
const KEY_HEX = "be17f4759963e2827e4d71f98600e440a9d9865c16724226c23d717280dcfd70";
const SEQ7_HEX = "43410100000007f5c07d2ee82175d7";

const start = Date.UTC(2026, 10, 3, 4, 45);
const heard = (seq: number, rssi = -60, secret = SECRET) => ({ data: makeBeaconPayload(beaconKey(secret), seq).toString("base64"), rssi });

describe("beacon code", () => {
  it("matches the shared test values", () => {
    expect(beaconKey(SECRET).toString("hex")).toBe(KEY_HEX);
    expect(makeBeaconPayload(beaconKey(SECRET), 7).toString("hex")).toBe(SEQ7_HEX);
  });

  it("counts 5-second steps from the start of the run", () => {
    expect(beaconSeqAt(start, start + 4_999)).toBe(0);
    expect(beaconSeqAt(start, start + 35_000)).toBe(7);
  });
});

describe("checkBeacons", () => {
  const at = start + 37_000; // seq 7 was issued 2 s ago

  it("accepts a current code for this run and reports its age", () => {
    expect(checkBeacons(SECRET, start, [heard(7, -71)], at)).toEqual({ ok: true, rssi: -71, ageMs: 2_000 });
  });

  it("picks the strongest valid code", () => {
    expect(checkBeacons(SECRET, start, [heard(6, -80), heard(7, -55), heard(7, -40, "other-run")], at).rssi).toBe(-55);
  });

  it("rejects old codes, codes from the future, other runs and junk", () => {
    expect(checkBeacons(SECRET, start, [heard(1)], at).ok).toBe(false); // issued 32 s ago
    expect(checkBeacons(SECRET, start, [heard(9)], at).ok).toBe(false); // issued 8 s from now
    expect(checkBeacons(SECRET, start, [heard(7, -60, "other-run")], at).ok).toBe(false);
    expect(checkBeacons(SECRET, start, [{ data: "Q0EB", rssi: -50 }], at).ok).toBe(false);
  });

  it("reports nothing heard as null", () => {
    expect(checkBeacons(SECRET, start, [], at)).toEqual({ ok: null, rssi: null, ageMs: null });
  });
});
