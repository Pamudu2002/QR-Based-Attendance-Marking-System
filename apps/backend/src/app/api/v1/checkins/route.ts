import { handler, readJson } from "@/lib/http";
import { authenticateDevice } from "@/lib/device-auth";
import { checkIn, CheckinInput } from "@/server/checkin";

/**
 * Signed check-in from the app. The receive time is taken first, on the server
 * clock, and is what token age is measured against. Always 200 with a verdict.
 */
export const POST = handler(async (req) => {
  const receivedAtMs = Date.now();
  const device = await authenticateDevice(req);
  return checkIn(device, await readJson(req, CheckinInput), receivedAtMs);
});
