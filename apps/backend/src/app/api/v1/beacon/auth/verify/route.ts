import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handler, readJson } from "@/lib/http";
import { challengeValid } from "@/lib/device-auth";
import { signedMessage, verifyDeviceSignature } from "@/lib/device-crypto";
import { ACCESS_TTL_SEC, signAccessToken } from "@/lib/tokens";

const Body = z.object({
  beaconId: z.string().min(1).max(40),
  nonce: z.string().min(1).max(1000),
  /** base64 DER signature of "QRv1-BEACON-LOGIN|beaconId|nonce" */
  signature: z.string().min(1).max(200),
});

/**
 * Step 2 of beacon login → a 15-minute access JWT. No refresh token: the key
 * needs no fingerprint, so the phone simply signs a new challenge when it expires.
 */
export const POST = handler(async (req) => {
  const body = await readJson(req, Body);
  const phone = await db.beaconPhone.findUnique({ where: { id: body.beaconId } });
  if (!phone) throw new ApiError(401, "UNLINKED", "This phone isn't linked any more. Link it again in the portal.");
  if (!(await challengeValid(body.nonce, phone.id))) {
    throw new ApiError(401, "BAD_CHALLENGE", "The login code expired. Try again.");
  }
  if (!verifyDeviceSignature(phone.publicKey, signedMessage.beaconLogin(phone.id, body.nonce), body.signature)) {
    throw new ApiError(401, "BAD_SIGNATURE", "This phone couldn't prove it's the linked beacon. Link it again.");
  }
  return { accessToken: await signAccessToken({ sub: phone.id, typ: "beacon" }), expiresInSec: ACCESS_TTL_SEC };
});
