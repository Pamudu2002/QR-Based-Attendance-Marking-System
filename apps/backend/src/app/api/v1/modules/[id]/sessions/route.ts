import { z } from "zod";
import { handler, readJson } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { createSessions, listSessions, SessionCreate } from "@/server/sessions";

type P = { id: string };

const Range = z.object({ from: z.coerce.date().optional(), to: z.coerce.date().optional() });

export const GET = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  const range = Range.parse(Object.fromEntries(req.nextUrl.searchParams));
  return { sessions: await listSessions(lecturerId, { moduleId: params.id, ...range }) };
});

/** Creates a session, or a weekly series with `repeatWeeks`. */
export const POST = handler<P>(async (req, { params }) => {
  const lecturerId = await requireLecturerId(req);
  const sessions = await createSessions(lecturerId, params.id, await readJson(req, SessionCreate));
  return Response.json({ sessions }, { status: 201 });
});
