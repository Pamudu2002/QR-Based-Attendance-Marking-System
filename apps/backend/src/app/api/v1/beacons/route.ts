import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { listBeaconPhones } from "@/server/beacons";

/** The lecturer's beacon phones with their live status (PLAN §6.5). */
export const GET = handler(async (req) => {
  const lecturerId = await requireLecturerId(req);
  return { phones: await listBeaconPhones(lecturerId) };
});
