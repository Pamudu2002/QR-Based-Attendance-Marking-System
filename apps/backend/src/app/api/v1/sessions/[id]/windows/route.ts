import { handler, readJson } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { startWindow, WindowInput } from "@/server/checkin";

/** Start check-in: `{ intervalSec?, requireBeacon?, mode?, label? }` → the new window. */
export const POST = handler<{ id: string }>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  const window = await startWindow(lecturerId, params.id, await readJson(req, WindowInput));
  return Response.json({ window }, { status: 201 });
});
