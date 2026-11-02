import { handler, readJson } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { markAttendance, MarkInput } from "@/server/attendance";

/** Manual mark `{ status, note }`; the note and the lecturer are saved with it. */
export const PUT = handler<{ id: string; studentId: string }>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  return markAttendance(lecturerId, params.id, params.studentId, await readJson(req, MarkInput));
});
