import { describe, expect, it } from "vitest";
import { decideCheckin, type CheckinState } from "./checkin-rules";

const start = Date.UTC(2026, 10, 3, 4, 45); // 10:15 in Colombo
const base: CheckinState = {
  device: { status: "ACTIVE", bound: true },
  signatureOk: true,
  tokenFresh: true,
  windowEndedBefore: false,
  registered: true,
  receivedAtMs: start + 5 * 60_000,
  session: {
    startsAtMs: start,
    endsAtMs: start + 2 * 3_600_000,
    opensBeforeMin: 15,
    lateAfterMin: 15,
    isExperiment: false,
  },
  requireBeacon: true,
  beaconOk: true,
  alreadyMarked: false,
};

describe("check-in verdicts (PLAN §6.1)", () => {
  it("marks present, then late after the late time", () => {
    expect(decideCheckin(base)).toEqual({ verdict: "OK", attendance: "PRESENT", beaconOk: true });
    expect(decideCheckin({ ...base, receivedAtMs: start + 15 * 60_000 }).attendance).toBe("PRESENT");
    expect(decideCheckin({ ...base, receivedAtMs: start + 15 * 60_000 + 1 }).attendance).toBe("LATE");
  });

  it("checks the device, signature and token first", () => {
    expect(decideCheckin({ ...base, device: { status: "REVOKED", bound: true } }).verdict).toBe("DEVICE_REVOKED");
    expect(decideCheckin({ ...base, device: { status: "ACTIVE", bound: false } }).verdict).toBe("UNKNOWN_DEVICE");
    expect(decideCheckin({ ...base, signatureOk: false }).verdict).toBe("BAD_SIGNATURE");
    expect(decideCheckin({ ...base, tokenFresh: false }).verdict).toBe("EXPIRED");
    expect(decideCheckin({ ...base, windowEndedBefore: true }).verdict).toBe("EXPIRED");
  });

  it("needs registration and the check-in time", () => {
    expect(decideCheckin({ ...base, registered: false }).verdict).toBe("NOT_REGISTERED");
    expect(decideCheckin({ ...base, receivedAtMs: start - 16 * 60_000 }).verdict).toBe("OUTSIDE_TIME");
    expect(decideCheckin({ ...base, receivedAtMs: start - 15 * 60_000 }).verdict).toBe("OK");
    expect(decideCheckin({ ...base, receivedAtMs: start + 2 * 3_600_000 + 1 }).verdict).toBe("OUTSIDE_TIME");
  });

  it("needs the classroom beacon when the run requires it", () => {
    expect(decideCheckin({ ...base, beaconOk: false })).toEqual({ verdict: "NO_BEACON", beaconOk: false });
    expect(decideCheckin({ ...base, beaconOk: null }).verdict).toBe("NO_BEACON");
    // Experiment runs and classes without a beacon phone: recorded only.
    expect(decideCheckin({ ...base, beaconOk: false, requireBeacon: false })).toEqual({ verdict: "OK", attendance: "PRESENT", beaconOk: false });
    expect(decideCheckin({ ...base, beaconOk: null, requireBeacon: false }).beaconOk).toBeNull();
    // Time is checked before the beacon.
    expect(decideCheckin({ ...base, beaconOk: false, receivedAtMs: start - 16 * 60_000 }).verdict).toBe("OUTSIDE_TIME");
  });

  it("keeps the first record, except in experiment sessions", () => {
    expect(decideCheckin({ ...base, alreadyMarked: true })).toEqual({ verdict: "DUPLICATE", beaconOk: true });
    const exp = { ...base, alreadyMarked: true, session: { ...base.session, isExperiment: true } };
    expect(decideCheckin(exp)).toEqual({ verdict: "OK", beaconOk: true });
  });
});
