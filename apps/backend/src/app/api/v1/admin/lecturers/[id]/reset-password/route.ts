import { handler } from "@/lib/http";
import { requireAdminId } from "@/lib/auth";
import { resetLecturerPassword } from "@/server/lecturers";

/** Gives the lecturer a new temporary password (returned once) and signs them out. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  await requireAdminId(req);
  return resetLecturerPassword(params.id);
});
