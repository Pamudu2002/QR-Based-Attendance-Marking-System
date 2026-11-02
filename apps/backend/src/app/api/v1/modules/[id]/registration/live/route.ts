import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { registrationLive } from "@/server/registration";

/** Registered count, latest registrations and failed attempts. */
export const GET = handler<{ id: string }>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  return Response.json(await registrationLive(lecturerId, params.id), { headers: { "Cache-Control": "no-store" } });
});
