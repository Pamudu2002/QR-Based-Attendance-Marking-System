import { handler, readJson } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { removeFromModule, renameRosterEntry, StudentInput } from "@/server/roster";

type P = { id: string; studentId: string };

const Patch = StudentInput.pick({ name: true });

export const PATCH = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  const { name } = await readJson(req, Patch);
  const entry = await renameRosterEntry(lecturerId, params.id, params.studentId, name);
  return { entry };
});

export const DELETE = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  await removeFromModule(lecturerId, params.id, params.studentId);
  return { ok: true };
});
