import "server-only";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { Prisma, type AttemptVerdict } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { signedMessage, verifyDeviceSignature } from "@/lib/device-crypto";
import { ApiError } from "@/lib/http";
import { moduleDisplayName } from "@/lib/identity";
import { checkToken, currentToken, macValid, readToken, stripPrefix, type Clock } from "@/lib/qr-token";
import { checkBeacons } from "@/lib/beacon";
import { decideCheckin } from "@/lib/checkin-rules";
import { getOwnedSession } from "./sessions";

const windowClock = (w: { startedAt: Date; intervalSec: number }): Clock => ({
  startedAtMs: w.startedAt.getTime(),
  intervalSec: w.intervalSec,
});

// ── Check-in windows (lecturer) ────────────────────────────────────────────

export const WindowInput = z.object({
  /** QR refresh interval T. Normal classes default to 10 s (PLAN §6.3). */
  intervalSec: z.number().int().min(3).max(60).default(10),
  /**
   * Require the classroom beacon. Defaults to on for classes when the lecturer has
   * a beacon phone; experiment runs only record it (PLAN §6.5, §9).
   */
  requireBeacon: z.boolean().optional(),
  mode: z.enum(["NORMAL", "EXP_GENUINE", "EXP_RELAY"]).default("NORMAL"),
  label: z.string().trim().max(60).nullish(),
});

/** Start check-in: opens a new window and ends any open one for the session. */
export async function startWindow(lecturerId: string, sessionId: string, input: z.infer<typeof WindowInput>) {
  const session = await getOwnedSession(lecturerId, sessionId);
  if (input.mode !== "NORMAL" && !session.isExperiment) {
    throw ApiError.badRequest("Experiment runs need an experiment session. Mark the session as an experiment first.");
  }
  const beaconPhones = await db.beaconPhone.count({ where: { lecturerId } });
  const now = new Date();
  const [, window] = await db.$transaction([
    db.checkinWindow.updateMany({ where: { sessionId, endedAt: null }, data: { endedAt: now } }),
    db.checkinWindow.create({
      data: {
        sessionId,
        intervalSec: input.intervalSec,
        mode: input.mode,
        label: input.label ?? null,
        requireBeacon: input.mode === "NORMAL" && (input.requireBeacon ?? beaconPhones > 0),
        secret: randomBytes(32).toString("base64url"),
        startedAt: now,
      },
    }),
  ]);
  const { secret: _secret, ...rest } = window;
  return rest;
}

async function getOwnedWindow(lecturerId: string, windowId: string) {
  const window = await db.checkinWindow.findFirst({
    where: { id: windowId, session: { module: { lecturerId } } },
    include: { session: { include: { module: true } } },
  });
  if (!window) throw ApiError.notFound("Check-in not found.");
  return window;
}

export async function endWindow(lecturerId: string, windowId: string) {
  const window = await getOwnedWindow(lecturerId, windowId);
  if (window.endedAt) return { endedAt: window.endedAt };
  const ended = await db.checkinWindow.update({ where: { id: windowId }, data: { endedAt: new Date() } });
  return { endedAt: ended.endedAt };
}

/** The current check-in QR for the projector page. Polled every 500 ms. */
export async function windowToken(lecturerId: string, windowId: string) {
  const window = await getOwnedWindow(lecturerId, windowId);
  if (window.endedAt) throw ApiError.conflict("WINDOW_ENDED", "This check-in has ended.");
  return currentToken("C", window.id, window.secret, windowClock(window), Date.now());
}

const REJECTED: AttemptVerdict[] = [
  "EXPIRED",
  "BAD_TOKEN",
  "BAD_SIGNATURE",
  "NO_BEACON",
  "UNKNOWN_DEVICE",
  "DEVICE_REVOKED",
  "NOT_REGISTERED",
  "OUTSIDE_TIME",
];

/** Live counter for the projector and the session page. */
export async function windowLive(lecturerId: string, windowId: string) {
  const window = await getOwnedWindow(lecturerId, windowId);
  const s = window.session;
  const [registered, marks, verdicts, latest, beaconHeard, beacon] = await Promise.all([
    db.rosterEntry.count({ where: { moduleId: s.moduleId, registeredAt: { not: null } } }),
    db.attendance.groupBy({ by: ["status"], where: { sessionId: s.id }, _count: { _all: true } }),
    db.attempt.groupBy({ by: ["verdict"], where: { windowId }, _count: { _all: true } }),
    db.attendance.findMany({
      where: { sessionId: s.id },
      orderBy: { markedAt: "desc" },
      take: 6,
      select: { status: true, markedAt: true, student: { select: { indexNumber: true } } },
    }),
    db.attempt.count({ where: { windowId, beaconOk: true } }),
    beaconStatus(s.module.lecturerId),
  ]);
  const count = (st: string) => marks.find((m) => m.status === st)?._count._all ?? 0;
  const attempts = verdicts.reduce((n, v) => n + v._count._all, 0);
  return {
    windowId,
    endedAt: window.endedAt,
    intervalSec: window.intervalSec,
    mode: window.mode,
    label: window.label,
    registered,
    checkedIn: count("PRESENT") + count("LATE") + count("EXCUSED"),
    onTime: count("PRESENT"),
    late: count("LATE"),
    rejected: verdicts.filter((v) => REJECTED.includes(v.verdict)).reduce((n, v) => n + v._count._all, 0),
    attempts,
    accepted: verdicts.find((v) => v.verdict === "OK")?._count._all ?? 0,
    latest: latest.map((l) => ({ indexNumber: l.student.indexNumber, status: l.status, at: l.markedAt })),
    beacon: { required: window.requireBeacon, heardBy: beaconHeard, phones: beacon },
  };
}

/** The lecturer's beacon phones as last reported: online if seen in the last 8 s. */
export async function beaconStatus(lecturerId: string) {
  const phones = await db.beaconPhone.findMany({
    where: { lecturerId },
    orderBy: { createdAt: "asc" },
    select: { id: true, model: true, lastSeenAt: true, lastState: true },
  });
  const now = Date.now();
  return phones.map((p) => ({
    id: p.id,
    model: p.model,
    online: !!p.lastSeenAt && now - p.lastSeenAt.getTime() < 8_000,
    state: p.lastState,
    lastSeenAt: p.lastSeenAt,
  }));
}

// ── Check-in (app) ─────────────────────────────────────────────────────────

/** Labels and timings the phone measures (PLAN §5.2, §9.1). All optional. */
const ClientFields = z.object({
  phoneLabel: z.string().trim().max(40).nullish(),
  distanceRow: z.enum(["FRONT", "MIDDLE", "BACK"]).nullish(),
  distanceM: z.number().min(0).max(200).nullish(),
  role: z.enum(["GENUINE", "RELAY"]).nullish(),
  runNo: z.number().int().min(0).max(10_000).nullish(),
  attemptNo: z.number().int().min(0).max(100_000).nullish(),
  firstFrameMs: z.number().min(0).max(600_000).nullish(),
  decodeMs: z.number().min(0).max(600_000).nullish(),
  framesProcessed: z.number().int().min(0).max(1_000_000).nullish(),
  framesDropped: z.number().int().min(0).max(1_000_000).nullish(),
  biometricMs: z.number().min(0).max(600_000).nullish(),
  postRttMs: z.number().min(0).max(600_000).nullish(),
  totalMs: z.number().min(0).max(600_000).nullish(),
  authMethod: z.string().max(40).nullish(),
  androidSdk: z.number().int().min(1).max(99).nullish(),
});
type ClientFields = z.infer<typeof ClientFields>;
const CLIENT_KEYS = Object.keys(ClientFields.shape) as (keyof ClientFields)[];

function clientData(input: ClientFields) {
  const out: Record<string, unknown> = {};
  for (const k of CLIENT_KEYS) if (input[k] !== undefined) out[k] = input[k];
  return out as Partial<Prisma.AttemptUncheckedCreateInput>;
}

export const CheckinInput = ClientFields.extend({
  /** The QR text ("QA1:C:…") or the bare token. */
  token: z.string().min(1).max(200),
  /** Client-generated UUID; also part of the signed message. */
  attemptId: z.uuid(),
  /** base64 DER signature of "QRv1-CHK|token|deviceId|attemptId" */
  signature: z.string().min(1).max(200),
  /** Classroom beacon codes heard while scanning (PLAN §6.5), strongest first. */
  beacons: z
    .array(
      z.object({
        /** The 15-byte manufacturer data, base64 */
        data: z.string().max(64),
        rssi: z.number().int().min(-127).max(20),
        /** How long before sending it was heard (phone's monotonic clock) */
        heardAgoMs: z.number().min(0).max(600_000).nullish(),
      }),
    )
    .max(5)
    .default([]),
});

const MESSAGES: Record<string, string> = {
  PRESENT: "You're checked in.",
  LATE: "You're checked in, but late.",
  OK: "You're checked in.",
  EXPIRED: "That code had already changed. Scan the code on the projector again.",
  BAD_TOKEN: "That isn't a check-in code for an open class.",
  BAD_SIGNATURE: "This phone couldn't prove it's yours. Set up the app again.",
  NO_BEACON: "Classroom beacon not found. Turn on Bluetooth and move closer to the front, then scan again.",
  UNKNOWN_DEVICE: "Register for this module first: scan its registration QR.",
  DEVICE_REVOKED: "This phone was reset by your lecturer. Set up the app again.",
  NOT_REGISTERED: "You're not registered for this module. Scan its registration QR first.",
  OUTSIDE_TIME: "Check-in for this class isn't open now.",
  DUPLICATE: "You're already checked in to this class.",
};

type CheckinDevice = { id: string; publicKey: string; status: "ACTIVE" | "REVOKED"; studentId: string | null; androidSdk: number };

/** The answer for an attempt that's already on the server (a retry with the same attemptId). */
async function resultFor(attemptId: string) {
  const a = await db.attempt.findUniqueOrThrow({
    where: { id: attemptId },
    include: { window: { include: { session: { include: { module: true } } } } },
  });
  const session = a.window?.session;
  const attendance =
    session && a.studentId
      ? await db.attendance.findUnique({ where: { sessionId_studentId: { sessionId: session.id, studentId: a.studentId } } })
      : null;
  let summary = null;
  if (session && a.studentId) {
    const past = await db.session.findMany({
      where: { moduleId: session.moduleId, isExperiment: false, startsAt: { lte: new Date() } },
      select: { id: true },
    });
    const attended = past.length
      ? await db.attendance.count({ where: { studentId: a.studentId, sessionId: { in: past.map((p) => p.id) } } })
      : 0;
    summary = { attended, pastSessions: past.length, attendancePct: past.length ? Math.round((attended / past.length) * 100) : null };
  }
  const status = a.verdict === "OK" ? (attendance?.status ?? null) : null;
  return {
    attemptId: a.id,
    verdict: a.verdict,
    attendance: status,
    message: MESSAGES[status ?? a.verdict] ?? a.reason ?? "",
    tokenAgeMs: a.tokenAgeMs,
    seq: a.seq,
    issuedAt: a.issuedAt,
    receivedAt: a.receivedAt,
    serverTime: new Date(),
    beaconOk: a.beaconOk,
    windowId: a.windowId,
    intervalSec: a.window?.intervalSec ?? null,
    graceSec: a.window?.graceSec ?? null,
    session: session
      ? { id: session.id, title: session.title, startsAt: session.startsAt, endsAt: session.endsAt, venue: session.venue }
      : null,
    module: session ? { id: session.module.id, code: session.module.code, displayName: moduleDisplayName(session.module) } : null,
    summary,
  };
}

/**
 * A signed check-in. Token age uses the server clock only (receivedAt is taken
 * before anything else). Every request is logged as an Attempt.
 */
export async function checkIn(device: CheckinDevice, input: z.infer<typeof CheckinInput>, receivedAtMs: number) {
  const existing = await db.attempt.findUnique({ where: { id: input.attemptId } });
  if (existing) {
    if (existing.deviceId !== device.id) throw ApiError.conflict("ATTEMPT_ID_TAKEN", "Try again.");
    if (existing.receivedAt) return resultFor(existing.id);
  }

  const token = stripPrefix("C", input.token);
  const receivedAt = new Date(receivedAtMs);
  const base = {
    ...clientData(input),
    androidSdk: input.androidSdk ?? device.androidSdk,
    deviceId: device.id,
    studentId: device.studentId,
    receivedAt,
  };

  const save = async (data: Prisma.AttemptUncheckedCreateInput, attendance?: { sessionId: string; status: "PRESENT" | "LATE" }) => {
    try {
      await db.$transaction(async (tx) => {
        await tx.attempt.upsert({ where: { id: input.attemptId }, create: data, update: data });
        if (attendance && device.studentId) {
          await tx.attendance.create({
            data: { sessionId: attendance.sessionId, studentId: device.studentId, status: attendance.status, source: "QR", attemptId: input.attemptId, markedAt: receivedAt },
          });
        }
      });
    } catch (err) {
      // Two check-ins for the same student at once: the first one wins.
      if (!(err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") || !attendance) throw err;
      await db.attempt.upsert({ where: { id: input.attemptId }, create: { ...data, verdict: "DUPLICATE" }, update: { ...data, verdict: "DUPLICATE" } });
    }
    return resultFor(input.attemptId);
  };

  const parsed = readToken(token);
  const window = parsed
    ? await db.checkinWindow.findUnique({ where: { id: parsed.id }, include: { session: true } })
    : null;
  if (!window || !macValid("C", token, window.secret)) {
    return save({ ...base, id: input.attemptId, verdict: "BAD_TOKEN", reason: "Unknown or forged check-in code" });
  }

  const check = checkToken("C", token, window.secret, windowClock(window), receivedAtMs, window.graceSec);
  const tokenFields = { windowId: window.id, seq: check.seq ?? parsed!.seq, issuedAt: check.issuedAt ?? null, tokenAgeMs: check.tokenAgeMs ?? null };
  if (!check.ok && check.verdict === "BAD_TOKEN") {
    return save({ ...base, ...tokenFields, id: input.attemptId, verdict: "BAD_TOKEN", reason: "Code from the future" });
  }

  const session = window.session;
  const signatureOk = verifyDeviceSignature(device.publicKey, signedMessage.checkin(token, device.id, input.attemptId), input.signature);
  const beacon = checkBeacons(window.secret, window.startedAt.getTime(), input.beacons, receivedAtMs);
  const [roster, mark] = device.studentId
    ? await Promise.all([
        db.rosterEntry.findUnique({ where: { moduleId_studentId: { moduleId: session.moduleId, studentId: device.studentId } } }),
        db.attendance.findUnique({ where: { sessionId_studentId: { sessionId: session.id, studentId: device.studentId } } }),
      ])
    : [null, null];

  const decision = decideCheckin({
    device: { status: device.status, bound: !!device.studentId },
    signatureOk,
    tokenFresh: check.ok,
    windowEndedBefore: !!window.endedAt && window.endedAt.getTime() < receivedAtMs,
    registered: !!roster?.registeredAt,
    receivedAtMs,
    session: {
      startsAtMs: session.startsAt.getTime(),
      endsAtMs: session.endsAt.getTime(),
      opensBeforeMin: session.opensBeforeMin,
      lateAfterMin: session.lateAfterMin,
      isExperiment: session.isExperiment,
    },
    requireBeacon: window.requireBeacon,
    beaconOk: beacon.ok,
    alreadyMarked: !!mark,
  });

  return save(
    {
      ...base,
      ...tokenFields,
      id: input.attemptId,
      verdict: decision.verdict,
      beaconOk: beacon.ok,
      beaconRssi: beacon.rssi,
      beaconAgeMs: beacon.ageMs,
    },
    decision.attendance ? { sessionId: session.id, status: decision.attendance } : undefined,
  );
}

// ── Attempts the server didn't see, and the timings measured after the reply ─

export const AttemptUpload = ClientFields.extend({
  id: z.uuid(),
  /** Only for attempts the server never received. */
  verdict: z.enum(["NO_DECODE", "CANCELLED", "NETWORK_ERROR"]).optional(),
  reason: z.string().max(200).nullish(),
  /** The code that was decoded, if any: links the attempt to its window and seq. */
  token: z.string().max(200).nullish(),
});

export const AttemptUploadBody = z.object({ attempts: z.array(AttemptUpload).max(500) });

/**
 * Upserts the phone's log. Existing attempts only get client fields (postRttMs
 * and totalMs are known only after the reply); server fields never change.
 */
export async function uploadAttempts(device: { id: string; studentId: string | null; androidSdk: number }, attempts: z.infer<typeof AttemptUpload>[]) {
  const saved: string[] = [];
  const rejected: { id: string; reason: string }[] = [];

  for (const a of attempts) {
    const existing = await db.attempt.findUnique({ where: { id: a.id }, select: { deviceId: true } });
    if (existing) {
      if (existing.deviceId !== device.id) {
        rejected.push({ id: a.id, reason: "Belongs to another device" });
        continue;
      }
      await db.attempt.update({ where: { id: a.id }, data: clientData(a) });
      saved.push(a.id);
      continue;
    }
    if (!a.verdict) {
      rejected.push({ id: a.id, reason: "Unknown attempt and no verdict" });
      continue;
    }

    let tokenFields = {};
    if (a.token) {
      const t = stripPrefix("C", a.token);
      const parsed = readToken(t);
      const window = parsed ? await db.checkinWindow.findUnique({ where: { id: parsed.id } }) : null;
      if (window && macValid("C", t, window.secret)) {
        tokenFields = { windowId: window.id, seq: parsed!.seq, issuedAt: new Date(window.startedAt.getTime() + parsed!.seq * window.intervalSec * 1000) };
      }
    }
    await db.attempt.create({
      data: {
        ...clientData(a),
        ...tokenFields,
        id: a.id,
        androidSdk: a.androidSdk ?? device.androidSdk,
        deviceId: device.id,
        studentId: device.studentId,
        verdict: a.verdict,
        reason: a.reason ?? null,
      },
    });
    saved.push(a.id);
  }
  return { saved, rejected };
}
