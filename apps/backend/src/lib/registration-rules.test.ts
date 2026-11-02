import { describe, expect, it } from "vitest";
import { decideRegistration, type RegistrationState } from "./registration-rules";

const base: RegistrationState = {
  registrationOpen: true,
  deviceId: "dev1",
  boundIndex: null,
  typedIndex: "220366X",
  typedName: "lokuhewa pc",
  roster: { rosterName: "Lokuhewa P. C.", registeredAt: null, registeredDeviceId: null },
  studentHasOtherDevice: false,
};

describe("registration verdicts (PLAN §6.1)", () => {
  it("binds an unbound phone on a name match", () => {
    expect(decideRegistration(base)).toEqual({ verdict: "REGISTERED", bind: true });
  });
  it("needs registration open", () => {
    expect(decideRegistration({ ...base, registrationOpen: false }).verdict).toBe("REGISTRATION_CLOSED");
  });
  it("needs the index on the roster", () => {
    expect(decideRegistration({ ...base, roster: null }).verdict).toBe("NOT_ON_ROSTER");
  });
  it("checks the name on first registration", () => {
    expect(decideRegistration({ ...base, typedName: "Lokuhewa P." }).verdict).toBe("NAME_MISMATCH");
  });
  it("stops a second phone for the same student", () => {
    expect(decideRegistration({ ...base, studentHasOtherDevice: true }).verdict).toBe("STUDENT_HAS_OTHER_DEVICE");
  });
  it("stops one phone serving two students", () => {
    expect(decideRegistration({ ...base, boundIndex: "220720E" }).verdict).toBe("DEVICE_BOUND_TO_OTHER_STUDENT");
  });
  it("lets a bound phone register for another module without retyping", () => {
    expect(decideRegistration({ ...base, boundIndex: "220366X", typedIndex: null, typedName: null })).toEqual({
      verdict: "REGISTERED",
      bind: false,
    });
  });
  it("is harmless when already registered", () => {
    const roster = { ...base.roster!, registeredAt: new Date(), registeredDeviceId: "dev1" };
    expect(decideRegistration({ ...base, boundIndex: "220366X", roster }).verdict).toBe("ALREADY_REGISTERED");
  });
});
