import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handler, readJson } from "@/lib/http";
import { issueRefreshToken, setAdminSession, verifyPassword } from "@/lib/auth";

const Body = z.object({
  email: z.string().trim().toLowerCase(),
  password: z.string(),
  keepLoggedIn: z.boolean().default(true),
});

export const POST = handler(async (req) => {
  const body = await readJson(req, Body);
  const admin = await db.admin.findUnique({ where: { email: body.email } });
  const ok = admin ? await verifyPassword(admin.passwordHash, body.password) : false;
  if (!admin || !ok) {
    throw new ApiError(401, "BAD_CREDENTIALS", "The email or password is wrong. Check them and try again.");
  }
  const refresh = await issueRefreshToken({ adminId: admin.id }, body.keepLoggedIn);
  await setAdminSession(admin.id, refresh, body.keepLoggedIn);
  return { admin: { id: admin.id, name: admin.name, email: admin.email } };
});
