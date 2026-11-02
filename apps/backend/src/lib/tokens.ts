// Access JWTs. No database or Node-only imports here: the proxy uses this file too.
import { jwtVerify, SignJWT } from "jose";

export const ACCESS_COOKIE = "qa_access";
export const REFRESH_COOKIE = "qa_refresh";
/** The refresh cookie is only sent to the auth routes. */
export const REFRESH_COOKIE_PATH = "/api/v1/auth";

export const ACCESS_TTL_SEC = 15 * 60;
export const REFRESH_TTL_SEC = 30 * 24 * 60 * 60;

/** lecturer: portal · device: student app · beacon: CSE Attendance Beacon (a lecturer's phone) */
export type AccessClaims = { sub: string; typ: "lecturer" | "device" | "beacon" };

function secret() {
  const raw = process.env.JWT_SECRET;
  if (!raw) throw new Error("Missing environment variable JWT_SECRET");
  return new TextEncoder().encode(raw);
}

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ typ: claims.typ })
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
    if (payload.typ !== "lecturer" && payload.typ !== "device" && payload.typ !== "beacon") return null;
    return { sub: payload.sub, typ: payload.typ };
  } catch {
    return null;
  }
}
