import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { removeBeaconPhone } from "@/server/beacons";

export const DELETE = handler<{ id: string }>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  await removeBeaconPhone(lecturerId, params.id);
  return { ok: true };
});
