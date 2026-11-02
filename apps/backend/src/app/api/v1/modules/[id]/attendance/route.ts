import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { moduleAttendance } from "@/server/attendance";

export const GET = handler<{ id: string }>(async (req, { params }) => moduleAttendance(await requireLecturerId(req), params.id));
