// Check-in verdicts (docs/PLAN.md §6.1, §6.3, §6.5). Pure: the service loads
// the state and applies the result. The token's HMAC and age are checked by
// qr-token.ts; this decides everything after that.

export type CheckinVerdict =
  | "OK"
  | "EXPIRED"
  | "BAD_SIGNATURE"
  | "NO_BEACON"
  | "UNKNOWN_DEVICE"
  | "DEVICE_REVOKED"
  | "NOT_REGISTERED"
  | "OUTSIDE_TIME"
  | "DUPLICATE";

export type CheckinState = {
  device: { status: "ACTIVE" | "REVOKED"; bound: boolean };
  signatureOk: boolean;
  /** From checkToken: false if older than T + grace. */
  tokenFresh: boolean;
  /** The window was ended before this request arrived. */
  windowEndedBefore: boolean;
  registered: boolean;
  receivedAtMs: number;
  session: {
    startsAtMs: number;
    endsAtMs: number;
    opensBeforeMin: number;
    lateAfterMin: number;
    isExperiment: boolean;
  };
  /** The run requires the classroom beacon (PLAN §6.5). */
  requireBeacon: boolean;
  /** From checkBeacons: a current code for this run was heard; null = none sent. */
  beaconOk: boolean | null;
  alreadyMarked: boolean;
};

export type CheckinDecision = {
  verdict: CheckinVerdict;
  /** Set when a new attendance row is created. */
  attendance?: "PRESENT" | "LATE";
  beaconOk: boolean | null;
};

export function decideCheckin(s: CheckinState): CheckinDecision {
  const { beaconOk } = s;
  const out = (verdict: CheckinVerdict, attendance?: "PRESENT" | "LATE"): CheckinDecision =>
    attendance ? { verdict, attendance, beaconOk } : { verdict, beaconOk };

  if (s.device.status === "REVOKED") return out("DEVICE_REVOKED");
  if (!s.device.bound) return out("UNKNOWN_DEVICE");
  if (!s.signatureOk) return out("BAD_SIGNATURE");
  if (!s.tokenFresh || s.windowEndedBefore) return out("EXPIRED");
  if (!s.registered) return out("NOT_REGISTERED");

  const opensAt = s.session.startsAtMs - s.session.opensBeforeMin * 60_000;
  if (s.receivedAtMs < opensAt || s.receivedAtMs > s.session.endsAtMs) return out("OUTSIDE_TIME");
  if (s.requireBeacon && beaconOk !== true) return out("NO_BEACON");

  if (s.alreadyMarked) {
    // Experiment sessions take repeated check-ins: every attempt is logged,
    // the first attendance row stays.
    return out(s.session.isExperiment ? "OK" : "DUPLICATE");
  }
  const lateAt = s.session.startsAtMs + s.session.lateAfterMin * 60_000;
  return out("OK", s.receivedAtMs > lateAt ? "LATE" : "PRESENT");
}
