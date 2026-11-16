import { describe, expect, it } from "vitest";
import {
  accountStatus,
  generateTempPassword,
  TEMP_PASSWORD_TTL_DAYS,
  tempPasswordExpired,
  tempPasswordExpiry,
} from "./lecturer-account";

describe("generateTempPassword", () => {
  it("makes four groups of four readable characters", () => {
    for (let i = 0; i < 200; i++) {
      const pw = generateTempPassword();
      expect(pw).toMatch(/^[A-HJ-NP-Za-km-z2-9]{4}(-[A-HJ-NP-Za-km-z2-9]{4}){3}$/);
      expect(pw).not.toMatch(/[01OIl]/);
    }
  });

  it("doesn't repeat", () => {
    const seen = new Set(Array.from({ length: 1000 }, generateTempPassword));
    expect(seen.size).toBe(1000);
  });
});

describe("temporary password expiry", () => {
  const now = new Date("2026-11-06T10:00:00Z");
  const expires = tempPasswordExpiry(now);

  it(`lasts ${TEMP_PASSWORD_TTL_DAYS} days`, () => {
    expect(expires.toISOString()).toBe("2026-11-13T10:00:00.000Z");
  });

  it("is pending until it runs out, then expired", () => {
    const account = { mustChangePassword: true, tempPasswordExpiresAt: expires };
    expect(accountStatus(account, now)).toBe("PENDING");
    expect(tempPasswordExpired(account, new Date(expires.getTime() - 1))).toBe(false);
    expect(tempPasswordExpired(account, expires)).toBe(true);
    expect(accountStatus(account, new Date(expires.getTime() + 1))).toBe("EXPIRED");
  });

  it("never expires once the lecturer has set their own password", () => {
    const account = { mustChangePassword: false, tempPasswordExpiresAt: null };
    expect(tempPasswordExpired(account, now)).toBe(false);
    expect(accountStatus(account, now)).toBe("ACTIVE");
  });
});
