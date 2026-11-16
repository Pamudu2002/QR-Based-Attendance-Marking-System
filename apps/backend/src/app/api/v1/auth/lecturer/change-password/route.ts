import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, handler, readJson } from "@/lib/http";
import {
  hashPassword,
  isPersistent,
  issueRefreshToken,
  requireLecturerId,
  revokeLecturerSessions,
  setLecturerSession,
  verifyPassword,
} from "@/lib/auth";
import { MIN_PASSWORD_LENGTH } from "@/lib/lecturer-account";
import { REFRESH_COOKIE } from "@/lib/tokens";

const Body = z.object({
  currentPassword: z.string().min(1, "Enter your current password."),
  newPassword: z.string().min(MIN_PASSWORD_LENGTH, `Use at least ${MIN_PASSWORD_LENGTH} characters.`).max(200),
});

/** Sets the lecturer's own password. Works while a temporary password is due for a change. */
export const POST = handler(async (req) => {
  const lecturerId = await requireLecturerId(req, { allowPasswordChange: true });
  const body = await readJson(req, Body);
  const lecturer = await db.lecturer.findUnique({ where: { id: lecturerId } });
  if (!lecturer) throw ApiError.unauthorized();

  if (!(await verifyPassword(lecturer.passwordHash, body.currentPassword))) {
    throw new ApiError(400, "BAD_CREDENTIALS", "The current password is wrong.", {
      fieldErrors: { currentPassword: ["The current password is wrong."] },
    });
  }
  if (body.newPassword === body.currentPassword) {
    throw new ApiError(400, "SAME_PASSWORD", "Choose a password different from the current one.", {
      fieldErrors: { newPassword: ["Choose a password different from the current one."] },
    });
  }

  const persistent = await isPersistent(req.cookies.get(REFRESH_COOKIE)?.value);
  await db.lecturer.update({
    where: { id: lecturerId },
    data: { passwordHash: await hashPassword(body.newPassword), mustChangePassword: false, tempPasswordExpiresAt: null },
  });
  // Every other session ends; this browser gets a fresh one without the change flag.
  await revokeLecturerSessions(lecturerId);
  const refresh = await issueRefreshToken({ lecturerId }, persistent);
  await setLecturerSession(lecturerId, refresh, persistent);
  return { ok: true };
});
