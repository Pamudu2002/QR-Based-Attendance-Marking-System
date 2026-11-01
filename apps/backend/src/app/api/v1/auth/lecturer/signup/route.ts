import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError, handler, readJson } from "@/lib/http";
import { hashPassword, issueRefreshToken, setLecturerSession } from "@/lib/auth";

const Body = z.object({
  name: z.string().trim().min(1, "Enter your name.").max(120),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
  password: z.string().min(8, "Use at least 8 characters.").max(200),
  keepLoggedIn: z.boolean().default(true),
});

export const POST = handler(async (req) => {
  const body = await readJson(req, Body);

  const allowed = env.allowedLecturerDomains();
  const domain = body.email.split("@")[1] ?? "";
  if (allowed.length > 0 && !allowed.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    throw new ApiError(403, "DOMAIN_NOT_ALLOWED", `Use your university email (${allowed.join(", ")}).`);
  }

  const existing = await db.lecturer.findUnique({ where: { email: body.email } });
  if (existing) throw ApiError.conflict("EMAIL_TAKEN", "An account with this email already exists. Log in instead.");

  const lecturer = await db.lecturer.create({
    data: { name: body.name, email: body.email, passwordHash: await hashPassword(body.password) },
    select: { id: true, name: true, email: true },
  });
  const refresh = await issueRefreshToken({ lecturerId: lecturer.id }, body.keepLoggedIn);
  await setLecturerSession(lecturer.id, refresh, body.keepLoggedIn);
  return { lecturer };
});
