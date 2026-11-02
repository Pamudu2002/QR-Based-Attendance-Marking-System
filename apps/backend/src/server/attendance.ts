import "server-only";
import { z } from "zod";
import type { AttendanceStatus } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { ApiError } from "@/lib/http";
import { moduleDisplayName, moduleShortName } from "@/lib/identity";
import { pseudonym } from "@/lib/pseudonym";
import { utcToZoned } from "@/lib/time";
import { getOwnedModule } from "./modules";
import { getOwnedSession } from "./sessions";

export type Mark = AttendanceStatus | "ABSENT";

// ── One session ────────────────────────────────────────────────────────────

/** Present / late / excused / absent among registered students; unregistered roster students separately. */
export async function sessionAttendance(lecturerId: string, sessionId: string) {
  const session = await getOwnedSession(lecturerId, sessionId);
  const [roster, marks, windows] = await Promise.all([
    db.rosterEntry.findMany({
      where: { moduleId: session.moduleId },
      orderBy: { student: { indexNumber: "asc" } },
      select: { rosterName: true, registeredAt: true, student: { select: { id: true, indexNumber: true } } },
    }),
    db.attendance.findMany({ where: { sessionId } }),
    db.checkinWindow.findMany({
      where: { sessionId },
      orderBy: { startedAt: "desc" },
      select: { id: true, intervalSec: true, graceSec: true, requireBeacon: true, mode: true, label: true, startedAt: true, endedAt: true, _count: { select: { attempts: true } } },
    }),
  ]);
  const markBy = new Map(marks.map((m) => [m.studentId, m]));

  const rows = roster
    .filter((r) => r.registeredAt)
    .map((r) => {
      const m = markBy.get(r.student.id);
      return {
        studentId: r.student.id,
        indexNumber: r.student.indexNumber,
        name: r.rosterName,
        status: (m?.status ?? "ABSENT") as Mark,
        markedAt: m?.markedAt ?? null,
        source: m?.source ?? null,
        note: m?.note ?? null,
      };
    });
  const notRegistered = roster
    .filter((r) => !r.registeredAt)
    .map((r) => ({ studentId: r.student.id, indexNumber: r.student.indexNumber, name: r.rosterName, status: (markBy.get(r.student.id)?.status ?? null) as Mark | null }));

  const counts = { PRESENT: 0, LATE: 0, EXCUSED: 0, ABSENT: 0 };
  for (const r of rows) counts[r.status]++;

  const { module, ...rest } = session;
  return {
    session: { ...rest, module: { ...module, displayName: moduleDisplayName(module), shortName: moduleShortName(module) } },
    activeWindow: windows.find((w) => !w.endedAt) ?? null,
    windows,
    rows,
    notRegistered,
    counts,
  };
}

export const MarkInput = z.object({
  status: z.enum(["PRESENT", "LATE", "EXCUSED", "ABSENT"]),
  note: z.string().trim().min(1, "Give a reason, e.g. 'Medical certificate'.").max(200),
});

/** Manual fix by the lecturer, with a reason. ABSENT removes the record. */
export async function markAttendance(lecturerId: string, sessionId: string, studentId: string, input: z.infer<typeof MarkInput>) {
  const session = await getOwnedSession(lecturerId, sessionId);
  const onRoster = await db.rosterEntry.findUnique({ where: { moduleId_studentId: { moduleId: session.moduleId, studentId } } });
  if (!onRoster) throw ApiError.notFound("This student isn't on the module's list.");

  if (input.status === "ABSENT") {
    await db.attendance.deleteMany({ where: { sessionId, studentId } });
    return { status: "ABSENT" as const };
  }
  const data = { status: input.status, source: "MANUAL" as const, markedBy: lecturerId, note: input.note, markedAt: new Date() };
  const row = await db.attendance.upsert({
    where: { sessionId_studentId: { sessionId, studentId } },
    create: { sessionId, studentId, ...data },
    update: data,
  });
  return { status: row.status };
}

// ── Whole module ───────────────────────────────────────────────────────────

const LETTER: Record<Mark, string> = { PRESENT: "P", LATE: "L", EXCUSED: "E", ABSENT: "A" };

/** Student × session matrix over past non-experiment sessions, with the 80% line. */
export async function moduleAttendance(lecturerId: string, moduleId: string) {
  const mod = await getOwnedModule(lecturerId, moduleId);
  const now = new Date();
  const [sessions, upcoming, roster] = await Promise.all([
    db.session.findMany({
      where: { moduleId, isExperiment: false, startsAt: { lt: now } },
      orderBy: { startsAt: "asc" },
      select: { id: true, title: true, startsAt: true, attendance: { select: { studentId: true, status: true } } },
    }),
    db.session.count({ where: { moduleId, isExperiment: false, startsAt: { gte: now } } }),
    db.rosterEntry.findMany({
      where: { moduleId, registeredAt: { not: null } },
      orderBy: { student: { indexNumber: "asc" } },
      select: { rosterName: true, student: { select: { id: true, indexNumber: true } } },
    }),
  ]);

  const total = sessions.length + upcoming;
  const maxMisses = Math.floor((total * 20) / 100);
  const students = roster.map((r) => {
    const cells = sessions.map((s) => (s.attendance.find((a) => a.studentId === r.student.id)?.status ?? "ABSENT") as Mark);
    const attended = cells.filter((c) => c !== "ABSENT").length;
    const missed = cells.length - attended;
    const pct = sessions.length ? Math.round((attended / sessions.length) * 100) : null;
    return {
      studentId: r.student.id,
      indexNumber: r.student.indexNumber,
      name: r.rosterName,
      cells: cells.map((c) => LETTER[c]),
      attended,
      late: cells.filter((c) => c === "LATE").length,
      pct,
      below80: pct !== null && pct < 80,
      /** Misses still allowed to finish at 80% or more; negative = can't reach 80%. */
      missesLeft: maxMisses - missed,
    };
  });

  const withPct = students.filter((s) => s.pct !== null);
  const bands = [
    { label: "< 50%", min: 0, max: 49 },
    { label: "50–59", min: 50, max: 59 },
    { label: "60–69", min: 60, max: 69 },
    { label: "70–79", min: 70, max: 79 },
    { label: "80–89", min: 80, max: 89 },
    { label: "90–100", min: 90, max: 100 },
  ].map((b) => ({ ...b, count: withPct.filter((s) => s.pct! >= b.min && s.pct! <= b.max).length }));

  return {
    module: { id: mod.id, displayName: moduleDisplayName(mod), shortName: moduleShortName(mod) },
    sessions: sessions.map((s) => ({ id: s.id, title: s.title, startsAt: s.startsAt })),
    upcoming,
    students,
    summary: {
      average: withPct.length ? Math.round(withPct.reduce((n, s) => n + s.pct!, 0) / withPct.length) : null,
      atOrAbove: withPct.filter((s) => !s.below80).length,
      below: withPct.filter((s) => s.below80).length,
      cannotReach: students.filter((s) => s.missesLeft < 0).length,
      lateTotal: students.reduce((n, s) => n + s.late, 0),
    },
    bands,
  };
}

export async function moduleAttendanceCsv(lecturerId: string, moduleId: string) {
  const m = await moduleAttendance(lecturerId, moduleId);
  const header = [
    "index_number",
    "name",
    ...m.sessions.map((s) => `${utcToZoned(s.startsAt).date} ${s.title}`),
    "attended",
    "sessions",
    "attendance_pct",
    "below_80",
  ];
  const rows = m.students.map((s) => [s.indexNumber, s.name, ...s.cells, s.attended, m.sessions.length, s.pct, s.below80 ? "yes" : "no"]);
  return { filename: `${m.module.shortName}_attendance.csv`, header, rows };
}

// ── Experiment export (PLAN §9.6: pseudonymised, no names or index numbers) ─

export async function attemptsCsv(lecturerId: string) {
  const myStudents = await db.rosterEntry.findMany({ where: { module: { lecturerId } }, select: { studentId: true }, distinct: ["studentId"] });
  const attempts = await db.attempt.findMany({
    where: {
      OR: [
        { window: { session: { module: { lecturerId } } } },
        // Attempts that never reached a window (no decode), from phones of my students.
        { windowId: null, studentId: { in: myStudents.map((s) => s.studentId) } },
      ],
    },
    orderBy: { createdAt: "asc" },
    include: {
      window: { select: { id: true, label: true, mode: true, intervalSec: true, graceSec: true, requireBeacon: true, session: { select: { isExperiment: true } } } },
      device: { select: { model: true, keyLevel: true } },
    },
  });

  const header = [
    "attempt_id", "created_at", "window_id", "window_label", "window_mode", "interval_sec", "grace_sec", "experiment_session",
    "phone_label", "distance_row", "distance_m", "role", "run_no", "attempt_no",
    "device", "student", "device_model", "android_sdk", "key_level", "auth_method",
    "first_frame_ms", "decode_ms", "frames_processed", "frames_dropped", "biometric_ms", "post_rtt_ms", "total_ms",
    "seq", "issued_at", "received_at", "token_age_ms", "require_beacon", "beacon_ok", "beacon_rssi", "beacon_age_ms", "verdict", "reason",
  ];
  const rows = attempts.map((a) => [
    a.id, a.createdAt, a.window?.id, a.window?.label, a.window?.mode, a.window?.intervalSec, a.window?.graceSec, a.window?.session.isExperiment,
    a.phoneLabel, a.distanceRow, a.distanceM, a.role, a.runNo, a.attemptNo,
    pseudonym("device", a.deviceId), pseudonym("student", a.studentId), a.device?.model, a.androidSdk, a.device?.keyLevel, a.authMethod,
    a.firstFrameMs, a.decodeMs, a.framesProcessed, a.framesDropped, a.biometricMs, a.postRttMs, a.totalMs,
    a.seq, a.issuedAt, a.receivedAt, a.tokenAgeMs, a.window?.requireBeacon, a.beaconOk, a.beaconRssi, a.beaconAgeMs, a.verdict, a.reason,
  ]);
  return { header, rows };
}
