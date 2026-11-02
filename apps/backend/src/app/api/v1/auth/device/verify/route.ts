import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handler, readJson } from "@/lib/http";
import { issueRefreshToken } from "@/lib/auth";
import { challengeValid } from "@/lib/device-auth";
import { signedMessage, verifyDeviceSignature } from "@/lib/device-crypto";
import { ACCESS_TTL_SEC, signAccessToken } from "@/lib/tokens";

const Body = z.object({
  deviceId: z.string().min(1).max(40),
  nonce: z.string().min(1).max(1000),
  /** base64 DER signature of "QRv1-LOGIN|deviceId|nonce" */
  signature: z.string().min(1).max(200),
});

/** Step 2 of app login: checks the signed nonce and returns an access JWT and a refresh token. */
export const POST = handler(async (req) => {
  const body = await readJson(req, Body);
  const device = await db.device.findUnique({ where: { id: body.deviceId } });
  if (!device) throw ApiError.notFound("Unknown device. Set up the app again.");
  if (device.status === "REVOKED") {
    throw new ApiError(403, "DEVICE_REVOKED", "This phone was reset by your lecturer. Set up the app again.");
  }
  if (!(await challengeValid(body.nonce, device.id))) {
    throw new ApiError(401, "BAD_CHALLENGE", "The login code expired. Try again.");
  }
  if (!verifyDeviceSignature(device.publicKey, signedMessage.login(device.id, body.nonce), body.signature)) {
    throw new ApiError(401, "BAD_SIGNATURE", "This phone couldn't prove it's yours. Set up the app again.");
  }
  return {
    accessToken: await signAccessToken({ sub: device.id, typ: "device" }),
    expiresInSec: ACCESS_TTL_SEC,
    refreshToken: await issueRefreshToken({ deviceId: device.id }, true),
    deviceId: device.id,
  };
});
