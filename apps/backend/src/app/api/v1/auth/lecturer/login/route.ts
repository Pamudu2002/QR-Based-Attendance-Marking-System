import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handler, readJson } from "@/lib/http";
import { issueRefreshToken, setLecturerSession, verifyPassword } from "@/lib/auth";

const Body = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
  keepLoggedIn: z.boolean().default(true),
});

export const POST = handler(async (req) => {
  const body = await readJson(req, Body);
  const lecturer = await db.lecturer.findUnique({ where: { email: body.email } });
  const ok = lecturer ? await verifyPassword(lecturer.passwordHash, body.password) : false;
  if (!lecturer || !ok) {
    throw new ApiError(401, "BAD_CREDENTIALS", "The email or password is wrong. Check them and try again.");
  }
  const refresh = await issueRefreshToken({ lecturerId: lecturer.id }, body.keepLoggedIn);
  await setLecturerSession(lecturer.id, refresh, body.keepLoggedIn);
  return { lecturer: { id: lecturer.id, name: lecturer.name, email: lecturer.email } };
});
