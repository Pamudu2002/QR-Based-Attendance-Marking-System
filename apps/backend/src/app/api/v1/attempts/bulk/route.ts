import { handler, readJson } from "@/lib/http";
import { authenticateDevice } from "@/lib/device-auth";
import { AttemptUploadBody, uploadAttempts } from "@/server/checkin";

/** The phone's attempt log: no-decode and cancelled attempts, and timings known only after the reply. */
export const POST = handler(async (req) => {
  const device = await authenticateDevice(req);
  const { attempts } = await readJson(req, AttemptUploadBody);
  return uploadAttempts(device, attempts);
});
