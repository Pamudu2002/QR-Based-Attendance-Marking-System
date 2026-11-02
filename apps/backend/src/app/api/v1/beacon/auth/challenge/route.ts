import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handler, readJson } from "@/lib/http";
import { issueChallenge } from "@/lib/device-auth";

const Body = z.object({ beaconId: z.string().min(1).max(40) });

/** Step 1 of beacon login: a nonce to sign with the phone's key. */
export const POST = handler(async (req) => {
  const { beaconId } = await readJson(req, Body);
  const phone = await db.beaconPhone.findUnique({ where: { id: beaconId }, select: { id: true } });
  if (!phone) throw new ApiError(401, "UNLINKED", "This phone isn't linked any more. Link it again in the portal.");
  return issueChallenge(phone.id);
});
