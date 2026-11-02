import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { csvResponse, toCsv } from "@/lib/csv";
import { moduleAttendanceCsv } from "@/server/attendance";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const { filename, header, rows } = await moduleAttendanceCsv(await requireLecturerId(req), params.id);
  return csvResponse(filename, toCsv(header, rows));
});
