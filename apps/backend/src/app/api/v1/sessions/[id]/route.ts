import { handler, readJson } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { deleteSession, getOwnedSession, SessionUpdate, updateSession } from "@/server/sessions";

type P = { id: string };

export const GET = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  return { session: await getOwnedSession(lecturerId, params.id) };
});

export const PATCH = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  return { session: await updateSession(lecturerId, params.id, await readJson(req, SessionUpdate)) };
});

export const DELETE = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  await deleteSession(lecturerId, params.id);
  return { ok: true };
});
