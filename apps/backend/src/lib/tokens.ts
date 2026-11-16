// Access JWTs. No database or Node-only imports here: the proxy uses this file too.
import { jwtVerify, SignJWT } from "jose";

export const ACCESS_COOKIE = "qa_access";
export const REFRESH_COOKIE = "qa_refresh";
/** The refresh cookie is only sent to the auth routes. */
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

/** Admin sessions have their own cookies, so they never mix with a lecturer session. */
export const ADMIN_ACCESS_COOKIE = "qa_admin_access";
export const ADMIN_REFRESH_COOKIE = "qa_admin_refresh";
export const ADMIN_REFRESH_COOKIE_PATH = "/api/v1/auth/admin";

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;

/**
 * lecturer: portal · admin: admin portal · device: student app · beacon: CSE Attendance Beacon (a lecturer's phone).
 * pwc: the lecturer still has a temporary password and may only change it.
 */
export type AccessClaims = { sub: string; typ: "lecturer" | "admin" | "device" | "beacon"; pwc?: boolean };

const TYPES: readonly string[] = ["lecturer", "admin", "device", "beacon"];

function secret() {
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error("Missing environment variable JWT_SECRET");
  return new TextEncoder().encode(raw);
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ typ: claims.typ, ...(claims.pwc ? { pwc: true } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TTL_SEC}s`)
    .sign(secret());
}

export async function verifyAccessToken(token: string | undefined): Promise<AccessClaims | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (typeof payload.sub !== "string") return null;
    if (typeof payload.typ !== "string" || !TYPES.includes(payload.typ)) return null;
    return {
      sub: payload.sub,
      typ: payload.typ as AccessClaims["typ"],
      ...(payload.pwc === true ? { pwc: true } : {}),
    };
  } catch {
    return null;
  }
}
