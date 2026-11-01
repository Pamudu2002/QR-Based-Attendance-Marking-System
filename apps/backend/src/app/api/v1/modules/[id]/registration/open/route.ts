import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { setRegistrationOpen } from "@/server/modules";

export const POST = handler<{ id: string }>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  const mod = await setRegistrationOpen(lecturerId, params.id, true);
  return { registrationOpen: mod.registrationOpen };
});
