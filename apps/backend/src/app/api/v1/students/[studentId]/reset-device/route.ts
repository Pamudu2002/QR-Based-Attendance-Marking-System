import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { resetDevice } from "@/server/roster";

export const POST = handler<{ studentId: string }>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  await resetDevice(lecturerId, params.studentId);
  return { ok: true };
});
