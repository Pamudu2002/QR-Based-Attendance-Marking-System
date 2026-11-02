import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handler, readJson } from "@/lib/http";
import { issueChallenge } from "@/lib/device-auth";

const Body = z.object({ deviceId: z.string().min(1).max(40) });

/** Step 1 of app login: a nonce the phone signs with its Keystore key. */
export const POST = handler(async (req) => {
  const { deviceId } = await readJson(req, Body);
  const device = await db.device.findUnique({ where: { id: deviceId }, select: { status: true } });
  if (!device) throw ApiError.notFound("Unknown device. Set up the app again.");
  if (device.status === "REVOKED") {
    throw new ApiError(403, "DEVICE_REVOKED", "This phone was reset by your lecturer. Set up the app again.");
  }
  return issueChallenge(deviceId);
});
