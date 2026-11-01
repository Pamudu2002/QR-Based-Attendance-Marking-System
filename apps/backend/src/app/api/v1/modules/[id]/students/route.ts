import { handler, readJson } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { addStudent, listRoster, RosterFilter, StudentInput } from "@/server/roster";

type P = { id: string };

export const GET = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  const filter = RosterFilter.parse(req.nextUrl.searchParams.get("status") ?? undefined);
  return listRoster(lecturerId, params.id, filter);
});

export const POST = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  const entry = await addStudent(lecturerId, params.id, await readJson(req, StudentInput));
  return Response.json({ entry }, { status: 201 });
});
