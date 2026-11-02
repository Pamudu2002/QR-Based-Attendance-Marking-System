import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { windowLive } from "@/server/checkin";

export const GET = handler<{ id: string }>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  return Response.json(await windowLive(lecturerId, params.id), { headers: { "Cache-Control": "no-store" } });
});
