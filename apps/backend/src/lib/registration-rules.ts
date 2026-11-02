// Registration verdicts (docs/PLAN.md §6.1), after the token and signature checks.
// Pure: the service loads the state and applies the result.
import { namesMatch } from "./identity";

export type RegistrationState = {
  registrationOpen: boolean;
  deviceId: string;
  /** Index number of the student this device is bound to, or null if unbound. */
  boundIndex: string | null;
  typedIndex: string | null;
  typedName: string | null;
  /** Roster entry for the index being registered, if it's on the module's list. */
  roster: { rosterName: string; registeredAt: Date | null; registeredDeviceId: string | null } | null;
  /** The student already has an ACTIVE device other than this one. */
  studentHasOtherDevice: boolean;
};

export type RegistrationDecision =
  | { verdict: "REGISTERED"; bind: boolean }
  | {
      verdict:
        | "ALREADY_REGISTERED"
        | "REGISTRATION_CLOSED"
        | "NOT_ON_ROSTER"
        | "NAME_MISMATCH"
        | "DEVICE_BOUND_TO_OTHER_STUDENT"
        | "STUDENT_HAS_OTHER_DEVICE";
    };

export function decideRegistration(s: RegistrationState): RegistrationDecision {
  if (!s.registrationOpen) return { verdict: "REGISTRATION_CLOSED" };

  const bound = s.boundIndex !== null;
  // One phone can't serve two people.
  if (bound && s.typedIndex && s.typedIndex !== s.boundIndex) return { verdict: "DEVICE_BOUND_TO_OTHER_STUDENT" };
  if (!s.roster) return { verdict: "NOT_ON_ROSTER" };
  // A bound phone already proved who it is; only the first registration checks the name.
  if (!bound && !namesMatch(s.typedName ?? "", s.roster.rosterName)) return { verdict: "NAME_MISMATCH" };
  if (s.roster.registeredAt && s.roster.registeredDeviceId === s.deviceId) return { verdict: "ALREADY_REGISTERED" };
  if (!bound && s.studentHasOtherDevice) return { verdict: "STUDENT_HAS_OTHER_DEVICE" };
  return { verdict: "REGISTERED", bind: !bound };
}
