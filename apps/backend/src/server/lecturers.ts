import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { hashPassword, revokeLecturerSessions } from "@/lib/auth";
import { accountStatus, generateTempPassword, tempPasswordExpiry } from "@/lib/lecturer-account";

// Lecturer accounts, managed by the admin. The temporary password is returned
// once and only its hash is stored.

export const LecturerInput = z.object({
  name: z.string().trim().min(1, "Enter the lecturer's name.").max(120),
  email: z.email("Enter a valid email address.").trim().toLowerCase(),
});

function assertAllowedDomain(email: string) {
  const allowed = env.allowedLecturerDomains();
  const domain = email.split("@")[1] ?? "";
  if (allowed.length > 0 && !allowed.some((d) => domain === d || domain.endsWith(`.${d}`))) {
    throw new ApiError(403, "DOMAIN_NOT_ALLOWED", `Use a university email (${allowed.join(", ")}).`, {
      fieldErrors: { email: [`Use a university email (${allowed.join(", ")}).`] },
    });
  }
}

export async function listLecturers() {
  const now = new Date();
  const rows = await db.lecturer.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
      mustChangePassword: true,
      tempPasswordExpiresAt: true,
      _count: { select: { modules: { where: { archivedAt: null } } } },
    },
  });
  return rows.map(({ _count, mustChangePassword, tempPasswordExpiresAt, ...l }) => ({
    ...l,
    status: accountStatus({ mustChangePassword, tempPasswordExpiresAt }, now),
    tempPasswordExpiresAt,
    modules: _count.modules,
  }));
}

/** Creates the account with a temporary password. The response is the only place it appears. */
export async function createLecturer(adminId: string, input: z.infer<typeof LecturerInput>) {
  assertAllowedDomain(input.email);
  const existing = await db.lecturer.findUnique({ where: { email: input.email }, select: { id: true } });
  if (existing) {
    throw new ApiError(409, "EMAIL_TAKEN", "A lecturer with this email already exists.", {
      fieldErrors: { email: ["A lecturer with this email already exists. Send them a new password instead."] },
    });
  }
  const tempPassword = generateTempPassword();
  const expiresAt = tempPasswordExpiry(new Date());
  const lecturer = await db.lecturer.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      tempPasswordExpiresAt: expiresAt,
      createdByAdminId: adminId,
    },
    select: { id: true, name: true, email: true },
  });
  return { lecturer, tempPassword, expiresAt };
}

/** A new temporary password: for a lost one, an expired one or a forgotten password. Signs the lecturer out. */
export async function resetLecturerPassword(lecturerId: string) {
  const tempPassword = generateTempPassword();
  const expiresAt = tempPasswordExpiry(new Date());
  const lecturer = await db.lecturer
    .update({
      where: { id: lecturerId },
      data: { passwordHash: await hashPassword(tempPassword), mustChangePassword: true, tempPasswordExpiresAt: expiresAt },
      select: { id: true, name: true, email: true },
    })
    .catch(() => {
      throw ApiError.notFound("Lecturer not found.");
    });
  await revokeLecturerSessions(lecturerId);
  return { lecturer, tempPassword, expiresAt };
}
