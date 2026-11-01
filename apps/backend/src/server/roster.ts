import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { cleanName, INDEX_RE, nameKey, normaliseIndex } from "@/lib/identity";
import { classifyRows, parseRosterCsv, type PreviewRow } from "@/lib/roster-csv";
import { getOwnedModule } from "./modules";

export const StudentInput = z.object({
  indexNumber: z
    .string()
    .transform(normaliseIndex)
    .refine((s) => INDEX_RE.test(s), "Index must be 6 digits and a letter, e.g. 220366X."),
  name: z
    .string()
    .transform(cleanName)
    .refine((s) => nameKey(s).length > 0, "Enter the student's name."),
});

export const RosterFilter = z.enum(["all", "registered", "not_registered"]).default("all");
export type RosterFilter = z.infer<typeof RosterFilter>;

/** Failed registration verdicts shown to the lecturer. */
const FAILED_VERDICTS = [
  "BAD_SIGNATURE",
  "NOT_ON_ROSTER",
  "NAME_MISMATCH",
  "DEVICE_BOUND_TO_OTHER_STUDENT",
  "STUDENT_HAS_OTHER_DEVICE",
] as const;

export type RosterRow = Awaited<ReturnType<typeof listRoster>>["rows"][number];

/** Roster with registration status, phone and attendance % (past non-experiment sessions). */
export async function listRoster(lecturerId: string, moduleId: string, filter: RosterFilter = "all") {
  await getOwnedModule(lecturerId, moduleId);
  const now = new Date();

  const [entries, pastSessions] = await Promise.all([
    db.rosterEntry.findMany({
      where: {
        moduleId,
        ...(filter === "registered" ? { registeredAt: { not: null } } : {}),
        ...(filter === "not_registered" ? { registeredAt: null } : {}),
      },
      orderBy: { student: { indexNumber: "asc" } },
      select: {
        rosterName: true,
        addedVia: true,
        addedAt: true,
        registeredAt: true,
        student: { select: { id: true, indexNumber: true } },
        registeredDevice: { select: { model: true, manufacturer: true, androidSdk: true, status: true } },
      },
    }),
    db.session.findMany({
      where: { moduleId, isExperiment: false, startsAt: { lt: now } },
      select: { id: true },
    }),
  ]);

  const attended = pastSessions.length
    ? await db.attendance.groupBy({
        by: ["studentId"],
        where: { sessionId: { in: pastSessions.map((s) => s.id) } },
        _count: { _all: true },
      })
    : [];
  const attendedBy = new Map(attended.map((a) => [a.studentId, a._count._all]));

  const rows = entries.map((e) => ({
    studentId: e.student.id,
    indexNumber: e.student.indexNumber,
    name: e.rosterName,
    addedVia: e.addedVia,
    addedAt: e.addedAt,
    registeredAt: e.registeredAt,
    device: e.registeredDevice,
    attendancePct:
      pastSessions.length > 0
        ? Math.round(((attendedBy.get(e.student.id) ?? 0) / pastSessions.length) * 100)
        : null,
  }));
  return { rows, pastSessions: pastSessions.length };
}

export async function rosterStats(lecturerId: string, moduleId: string) {
  await getOwnedModule(lecturerId, moduleId);
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const [byVia, registered, failedToday] = await Promise.all([
    db.rosterEntry.groupBy({ by: ["addedVia"], where: { moduleId }, _count: { _all: true } }),
    db.rosterEntry.count({ where: { moduleId, registeredAt: { not: null } } }),
    db.registrationEvent.findMany({
      where: { moduleId, at: { gte: startOfDay }, verdict: { in: [...FAILED_VERDICTS] } },
      orderBy: { at: "desc" },
      take: 20,
      select: { id: true, indexNumberTyped: true, verdict: true, at: true },
    }),
  ]);
  const csv = byVia.find((v) => v.addedVia === "CSV")?._count._all ?? 0;
  const manual = byVia.find((v) => v.addedVia === "MANUAL")?._count._all ?? 0;
  return { total: csv + manual, csv, manual, registered, failedToday };
}

export async function addStudent(lecturerId: string, moduleId: string, input: z.infer<typeof StudentInput>) {
  await getOwnedModule(lecturerId, moduleId);
  const student = await db.student.upsert({
    where: { indexNumber: input.indexNumber },
    create: { indexNumber: input.indexNumber },
    update: {},
  });
  const existing = await db.rosterEntry.findUnique({
    where: { moduleId_studentId: { moduleId, studentId: student.id } },
  });
  if (existing) {
    throw ApiError.conflict("ALREADY_ON_ROSTER", `${input.indexNumber} is already on this module's list.`);
  }
  return db.rosterEntry.create({
    data: { moduleId, studentId: student.id, rosterName: input.name, addedVia: "MANUAL" },
  });
}

export async function renameRosterEntry(lecturerId: string, moduleId: string, studentId: string, name: string) {
  await getOwnedModule(lecturerId, moduleId);
  return db.rosterEntry.update({
    where: { moduleId_studentId: { moduleId, studentId } },
    data: { rosterName: name },
  });
}

export async function removeFromModule(lecturerId: string, moduleId: string, studentId: string) {
  await getOwnedModule(lecturerId, moduleId);
  await db.rosterEntry.delete({ where: { moduleId_studentId: { moduleId, studentId } } });
}

/**
 * Revokes the student's active phone so they can register a new one. Every
 * roster entry registered with that phone goes back to "Not registered".
 */
export async function resetDevice(lecturerId: string, studentId: string) {
  const onMyRoster = await db.rosterEntry.findFirst({
    where: { studentId, module: { lecturerId } },
    select: { id: true },
  });
  if (!onMyRoster) throw ApiError.notFound("Student not found.");

  const device = await db.device.findFirst({ where: { studentId, status: "ACTIVE" } });
  if (!device) throw ApiError.conflict("NO_ACTIVE_DEVICE", "This student has no registered phone.");

  await db.$transaction([
    db.device.update({ where: { id: device.id }, data: { status: "REVOKED" } }),
    db.refreshToken.updateMany({ where: { deviceId: device.id, revokedAt: null }, data: { revokedAt: new Date() } }),
    db.rosterEntry.updateMany({
      where: { registeredDeviceId: device.id },
      data: { registeredAt: null, registeredDeviceId: null },
    }),
  ]);
}

// ── CSV import ─────────────────────────────────────────────────────────────

export const ImportInput = z.object({
  csv: z.string().max(512 * 1024, "The file is too large. The limit is 512 KB."),
  /** Index numbers whose roster name should be replaced with the name in the file. */
  updateNames: z.array(z.string().transform(normaliseIndex)).default([]),
});

export type ImportPreview = {
  format: "template" | "moodle" | "no-header";
  rows: PreviewRow[];
  counts: Record<PreviewRow["result"], number>;
};

type RosterReader = Pick<typeof db, "rosterEntry">;

async function rosterNames(moduleId: string, client: RosterReader = db) {
  const entries = await client.rosterEntry.findMany({
    where: { moduleId },
    select: { rosterName: true, student: { select: { indexNumber: true } } },
  });
  return new Map(entries.map((e) => [e.student.indexNumber, e.rosterName]));
}

function preview(csv: string, roster: Map<string, string>): ImportPreview {
  const parsed = parseRosterCsv(csv);
  if (!parsed.ok) throw new ApiError(400, "BAD_CSV", parsed.error);
  const rows = classifyRows(parsed.rows, roster);
  const counts = { new: 0, unchanged: 0, name_differs: 0, error: 0 };
  for (const r of rows) counts[r.result]++;
  return { format: parsed.format, rows, counts };
}

export async function importDryRun(lecturerId: string, moduleId: string, csv: string) {
  await getOwnedModule(lecturerId, moduleId);
  return preview(csv, await rosterNames(moduleId));
}

/** Saves the import in one transaction: every row or none. Error rows are skipped. */
export async function importCommit(lecturerId: string, moduleId: string, input: z.infer<typeof ImportInput>) {
  await getOwnedModule(lecturerId, moduleId);
  const update = new Set(input.updateNames);

  return db.$transaction(
    async (tx) => {
      // Re-check against the roster inside the transaction.
      const result = preview(input.csv, await rosterNames(moduleId, tx));
      const toAdd = result.rows.filter((r) => r.result === "new");
      const toRename = result.rows.filter((r) => r.result === "name_differs" && update.has(r.indexNumber));

      if (toAdd.length) {
        await tx.student.createMany({
          data: toAdd.map((r) => ({ indexNumber: r.indexNumber })),
          skipDuplicates: true,
        });
        const students = await tx.student.findMany({
          where: { indexNumber: { in: toAdd.map((r) => r.indexNumber) } },
          select: { id: true, indexNumber: true },
        });
        const idBy = new Map(students.map((s) => [s.indexNumber, s.id]));
        await tx.rosterEntry.createMany({
          data: toAdd.map((r) => ({
            moduleId,
            studentId: idBy.get(r.indexNumber)!,
            rosterName: r.name,
            addedVia: "CSV" as const,
          })),
        });
      }

      for (const r of toRename) {
        await tx.rosterEntry.updateMany({
          where: { moduleId, student: { indexNumber: r.indexNumber } },
          data: { rosterName: r.name },
        });
      }

      return { added: toAdd.length, renamed: toRename.length, skipped: result.counts.error };
    },
    { timeout: 30_000 },
  );
}
