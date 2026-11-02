import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { moduleDisplayName } from "@/lib/identity";
import { parseDevicePublicKey } from "@/lib/device-crypto";

// ── Device setup ───────────────────────────────────────────────────────────

export const DeviceInput = z.object({
  /** X.509 SubjectPublicKeyInfo DER, base64 (EC P-256). */
  publicKey: z.string().min(80).max(400),
  keyLevel: z.enum(["STRONGBOX", "TEE", "SOFTWARE"]),
  model: z.string().trim().min(1).max(80),
  manufacturer: z.string().trim().min(1).max(80),
  androidSdk: z.number().int().min(23).max(99),
  /** Experiment phone label, e.g. "P1-lowend". */
  label: z.string().trim().max(40).nullish(),
});

export async function createDevice(input: z.infer<typeof DeviceInput>) {
  if (!parseDevicePublicKey(input.publicKey)) {
    throw ApiError.badRequest("The public key must be an EC P-256 key in X.509 SubjectPublicKeyInfo DER, base64.");
  }
  const device = await db.device.create({
    data: { ...input, label: input.label ?? null, publicKey: input.publicKey.replace(/\s+/g, "") },
    select: { id: true, keyLevel: true, status: true, createdAt: true },
  });
  return device;
}

// ── "Me" and my modules ────────────────────────────────────────────────────

type Device = { id: string; keyLevel: string; status: string; studentId: string | null; label: string | null };

export async function studentMe(device: Device) {
  if (!device.studentId) {
    return { device: { id: device.id, keyLevel: device.keyLevel, status: device.status, label: device.label }, student: null };
  }
  const student = await db.student.findUniqueOrThrow({
    where: { id: device.studentId },
    select: {
      indexNumber: true,
      roster: {
        where: { registeredAt: { not: null } },
        select: { rosterName: true, moduleId: true },
      },
    },
  });
  return {
    device: { id: device.id, keyLevel: device.keyLevel, status: device.status, label: device.label },
    student: {
      indexNumber: student.indexNumber,
      // Lecturers may type the name a little differently; show the first one.
      name: student.roster[0]?.rosterName ?? null,
      names: student.roster.map((r) => ({ moduleId: r.moduleId, name: r.rosterName })),
    },
  };
}

/** Attendance % over past non-experiment sessions of a module. */
async function attendanceSummary(moduleId: string, studentId: string) {
  const now = new Date();
  const past = await db.session.findMany({
    where: { moduleId, isExperiment: false, startsAt: { lt: now } },
    select: { id: true },
  });
  const attended = past.length
    ? await db.attendance.count({ where: { studentId, sessionId: { in: past.map((s) => s.id) } } })
    : 0;
  return {
    pastSessions: past.length,
    attended,
    attendancePct: past.length ? Math.round((attended / past.length) * 100) : null,
  };
}

export async function myModules(device: Device) {
  if (!device.studentId) return { modules: [] };
  const entries = await db.rosterEntry.findMany({
    where: { studentId: device.studentId, registeredAt: { not: null }, module: { archivedAt: null } },
    orderBy: { registeredAt: "asc" },
    select: {
      rosterName: true,
      registeredAt: true,
      module: {
        select: {
          id: true,
          intake: true,
          semester: true,
          code: true,
          name: true,
          lecturer: { select: { name: true } },
          sessions: {
            where: { endsAt: { gte: new Date() }, isExperiment: false },
            orderBy: { startsAt: "asc" },
            take: 1,
            select: { id: true, title: true, startsAt: true, endsAt: true, venue: true },
          },
        },
      },
    },
  });

  const modules = await Promise.all(
    entries.map(async (e) => ({
      id: e.module.id,
      displayName: moduleDisplayName(e.module),
      code: e.module.code,
      name: e.module.name,
      lecturer: e.module.lecturer.name,
      nameOnList: e.rosterName,
      registeredAt: e.registeredAt,
      nextSession: e.module.sessions[0] ?? null,
      ...(await attendanceSummary(e.module.id, device.studentId!)),
    })),
  );
  return { modules };
}

export async function myModule(device: Device, moduleId: string) {
  const entry = device.studentId
    ? await db.rosterEntry.findUnique({
        where: { moduleId_studentId: { moduleId, studentId: device.studentId } },
        include: { module: { include: { lecturer: { select: { name: true } } } } },
      })
    : null;
  if (!entry?.registeredAt) throw ApiError.notFound("You're not registered for this module.");

  const now = new Date();
  const sessions = await db.session.findMany({
    where: { moduleId, isExperiment: false },
    orderBy: { startsAt: "asc" },
    select: {
      id: true,
      title: true,
      startsAt: true,
      endsAt: true,
      venue: true,
      attendance: { where: { studentId: device.studentId! }, select: { status: true, markedAt: true } },
    },
  });

  const toItem = (s: (typeof sessions)[number]) => {
    const a = s.attendance[0];
    const status = a ? a.status : s.startsAt < now ? (s.endsAt < now ? "ABSENT" : "NOT_YET") : "UPCOMING";
    return { id: s.id, title: s.title, startsAt: s.startsAt, endsAt: s.endsAt, venue: s.venue, status, markedAt: a?.markedAt ?? null };
  };

  return {
    module: {
      id: entry.module.id,
      displayName: moduleDisplayName(entry.module),
      code: entry.module.code,
      name: entry.module.name,
      shortName: `${entry.module.intake}-${entry.module.semester}-${entry.module.code}`,
      lecturer: entry.module.lecturer.name,
      nameOnList: entry.rosterName,
    },
    ...(await attendanceSummary(moduleId, device.studentId!)),
    upcoming: sessions.filter((s) => s.endsAt >= now).map(toItem),
    history: sessions.filter((s) => s.endsAt < now).reverse().map(toItem),
  };
}
