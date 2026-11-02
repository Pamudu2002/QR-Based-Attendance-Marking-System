import { handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";
import { sessionAttendance } from "@/server/attendance";

export const GET = handler<{ id: string }>(async (req, { params }) => sessionAttendance(await requireLecturerId(req), params.id));
