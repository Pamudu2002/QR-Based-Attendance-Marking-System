import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { windowToken } from "@/server/checkin";

/** Current check-in QR for the projector page. Polled every 500 ms. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  return Response.json(await windowToken(lecturerId, params.id), { headers: { "Cache-Control": "no-store" } });
});
