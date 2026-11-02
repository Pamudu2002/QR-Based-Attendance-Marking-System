import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { beaconLinkCode } from "@/server/beacons";

/** A one-time QR (valid 2 minutes) that links a phone running CSE Attendance Beacon to this lecturer. */
export const POST = handler(async (req) => {
  const lecturerId = await requireLecturerId(req);
  return beaconLinkCode(lecturerId);
});
