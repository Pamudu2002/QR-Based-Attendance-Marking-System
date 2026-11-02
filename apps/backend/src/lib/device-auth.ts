import "server-only";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { db } from "./db";
import { env } from "./env";
import { ApiError } from "./http";
import { verifyAccessToken } from "./tokens";

const CHALLENGE_TTL_SEC = 60;

/**
 * Login challenge for a device. Stateless: the nonce is a short-lived signed
 * token naming the device, so the server stores nothing between the two calls.
 */
export async function issueChallenge(deviceId: string) {
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_SEC * 1000);
  const nonce = await new SignJWT({ typ: "challenge", n: randomBytes(16).toString("base64url") })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(deviceId)
    .setIssuedAt()
    .setExpirationTime(`${CHALLENGE_TTL_SEC}s`)
    .sign(env.jwtSecret());
  return { nonce, expiresAt };
}

export async function challengeValid(nonce: string, deviceId: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(nonce, env.jwtSecret(), { algorithms: ["HS256"] });
    return payload.typ === "challenge" && payload.sub === deviceId;
  } catch {
    return false;
  }
}

/** The calling device from its access JWT, revoked or not. 401 without a valid token. */
export async function authenticateDevice(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const claims = await verifyAccessToken(bearer);
  if (!claims || claims.typ !== "device") throw ApiError.unauthorized("Log in again from the app.");
  const device = await db.device.findUnique({
    where: { id: claims.sub },
    include: { student: { select: { id: true, indexNumber: true } } },
  });
  if (!device) throw ApiError.unauthorized("Log in again from the app.");
  return device;
}

/** For app routes: the calling device (from its access JWT). Revoked devices get 403. */
export async function requireDevice(req: NextRequest) {
  const device = await authenticateDevice(req);
  if (device.status === "REVOKED") {
    throw new ApiError(403, "DEVICE_REVOKED", "This phone was reset by your lecturer. Set up the app again to register this phone.");
  }
  return device;
}
