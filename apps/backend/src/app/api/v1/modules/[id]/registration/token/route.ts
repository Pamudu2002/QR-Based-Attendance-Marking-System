import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { registrationToken } from "@/server/registration";

/** Current registration QR for the projector page. Polled every 500 ms. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  return Response.json(await registrationToken(lecturerId, params.id), { headers: { "Cache-Control": "no-store" } });
});
