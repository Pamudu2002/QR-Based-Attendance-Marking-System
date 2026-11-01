import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { moduleShortName } from "@/lib/identity";

export const ModuleInput = z.object({
  intake: z.string().trim().min(1, "Enter the intake, e.g. In22.").max(16),
  semester: z.string().trim().min(1, "Enter the semester, e.g. S7.").max(16),
  code: z
    .string()
    .trim()
    .min(1, "Enter the module code, e.g. CS4473.")
    .max(16)
    .transform((s) => s.toUpperCase()),
  name: z.string().trim().min(1, "Enter the module name.").max(120),
});
export type ModuleInput = z.infer<typeof ModuleInput>;

/** The module, if this lecturer owns it. Otherwise 404 (don't reveal it exists). */
export async function getOwnedModule(lecturerId: string, moduleId: string) {
  const mod = await db.module.findFirst({ where: { id: moduleId, lecturerId } });
  if (!mod) throw ApiError.notFound("Module not found.");
  return mod;
}

async function assertKeyFree(lecturerId: string, input: ModuleInput, exceptId?: string) {
  const clash = await db.module.findFirst({
    where: {
      lecturerId,
      intake: input.intake,
      semester: input.semester,
      code: input.code,
      ...(exceptId ? { NOT: { id: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (clash) {
    throw new ApiError(409, "MODULE_EXISTS", `You already have ${moduleShortName(input)}. Use another code.`, {
      fieldErrors: { code: [`You already have ${moduleShortName(input)}. Use another code.`] },
    });
  }
}

export async function createModule(lecturerId: string, input: ModuleInput) {
  await assertKeyFree(lecturerId, input);
  return db.module.create({
    data: { ...input, lecturerId, regSecret: randomBytes(32).toString("base64url") },
  });
}

export async function updateModule(
  lecturerId: string,
  moduleId: string,
  input: Partial<ModuleInput> & { archived?: boolean },
) {
  const current = await getOwnedModule(lecturerId, moduleId);
  const { archived, ...fields } = input;
  const merged = { intake: current.intake, semester: current.semester, code: current.code, name: current.name, ...fields };
  await assertKeyFree(lecturerId, merged, moduleId);
  return db.module.update({
    where: { id: moduleId },
    data: {
      ...fields,
      ...(archived === undefined ? {} : { archivedAt: archived ? (current.archivedAt ?? new Date()) : null }),
    },
  });
}

export async function deleteModule(lecturerId: string, moduleId: string) {
  await getOwnedModule(lecturerId, moduleId);
  await db.module.delete({ where: { id: moduleId } });
}

export async function setRegistrationOpen(lecturerId: string, moduleId: string, open: boolean) {
  await getOwnedModule(lecturerId, moduleId);
  return db.module.update({ where: { id: moduleId }, data: { registrationOpen: open } });
}

export type ModuleSummary = Awaited<ReturnType<typeof listModules>>[number];

/** My modules with roster counts and the next session, for the cards. */
export async function listModules(lecturerId: string, opts: { archived?: boolean } = {}) {
  const now = new Date();
  const modules = await db.module.findMany({
    where: { lecturerId, archivedAt: opts.archived ? { not: null } : null },
    orderBy: [{ intake: "desc" }, { semester: "desc" }, { code: "asc" }],
    select: {
      id: true,
      intake: true,
      semester: true,
      code: true,
      name: true,
      registrationOpen: true,
      archivedAt: true,
      _count: { select: { roster: true } },
      sessions: {
        where: { endsAt: { gte: now } },
        orderBy: { startsAt: "asc" },
        take: 1,
        select: { id: true, title: true, startsAt: true, endsAt: true, venue: true },
      },
    },
  });

  const registered = await db.rosterEntry.groupBy({
    by: ["moduleId"],
    where: { moduleId: { in: modules.map((m) => m.id) }, registeredAt: { not: null } },
    _count: { _all: true },
  });
  const regBy = new Map(registered.map((r) => [r.moduleId, r._count._all]));

  return modules.map(({ _count, sessions, ...m }) => ({
    ...m,
    students: _count.roster,
    registered: regBy.get(m.id) ?? 0,
    nextSession: sessions[0] ?? null,
  }));
}
