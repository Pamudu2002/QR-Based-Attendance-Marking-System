import { db } from "@/lib/db";
import { ApiError, handler } from "@/lib/http";
import { requireLecturerId } from "@/lib/auth";

export const GET = handler(async (req) => {
  const lecturerId = await requireLecturerId(req);
  const lecturer = await db.lecturer.findUnique({
    where: { id: lecturerId },
    select: { id: true, name: true, email: true, createdAt: true },
  });
  if (!lecturer) throw ApiError.unauthorized();
  return { lecturer };
});
