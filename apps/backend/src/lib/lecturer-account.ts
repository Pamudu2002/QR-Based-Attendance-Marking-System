// Lecturer accounts made by the admin: temporary passwords and account status.
// No database here, so the rules can be unit-tested. Uses Web Crypto, so client
// components can import the constants too.

/** How long a temporary password works before the admin has to send a new one. */
export const TEMP_PASSWORD_TTL_DAYS = 7;

/** No look-alike characters (0/O, 1/l/I), so it can be read out or typed from a message. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
const GROUPS = 4;
const GROUP_LEN = 4;

/** A uniform random index below ALPHABET.length (rejection sampling, no modulo bias). */
function randomIndex(): number {
  const limit = 256 - (256 % ALPHABET.length);
  const byte = new Uint8Array(1);
  do crypto.getRandomValues(byte);
  while (byte[0]! >= limit);
  return byte[0]! % ALPHABET.length;
}

/** 16 random characters in groups of 4, e.g. "Kp7t-QmZ3-wd9H-x4Rc" (about 92 bits). */
export function generateTempPassword(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUPS; g++) {
    let group = "";
    for (let i = 0; i < GROUP_LEN; i++) group += ALPHABET[randomIndex()];
    groups.push(group);
  }
  return groups.join("-");
}

export function tempPasswordExpiry(now: Date): Date {
  return new Date(now.getTime() + TEMP_PASSWORD_TTL_DAYS * 24 * 60 * 60 * 1000);
}

type AccountFields = { mustChangePassword: boolean; tempPasswordExpiresAt: Date | null };

/** True when the lecturer still has a temporary password and it has run out. */
export function tempPasswordExpired(account: AccountFields, now: Date): boolean {
  return (
    account.mustChangePassword &&
    account.tempPasswordExpiresAt !== null &&
    account.tempPasswordExpiresAt.getTime() <= now.getTime()
  );
}

/** ACTIVE: own password set · PENDING: temporary password not used yet · EXPIRED: needs a new one. */
export type AccountStatus = "ACTIVE" | "PENDING" | "EXPIRED";

export function accountStatus(account: AccountFields, now: Date): AccountStatus {
  if (!account.mustChangePassword) return "ACTIVE";
  return tempPasswordExpired(account, now) ? "EXPIRED" : "PENDING";
}

export const MIN_PASSWORD_LENGTH = 8;
