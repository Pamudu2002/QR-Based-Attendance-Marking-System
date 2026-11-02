import "server-only";
import { z } from "zod";
import { Prisma, type RegistrationVerdict } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { verifyDeviceSignature, signedMessage } from "@/lib/device-crypto";
import { ApiError } from "@/lib/http";
import { cleanName, INDEX_RE, moduleDisplayName, normaliseIndex } from "@/lib/identity";
import { checkToken, currentToken, GRACE_SEC, readToken, stripPrefix, type Clock } from "@/lib/qr-token";
import { decideRegistration } from "@/lib/registration-rules";
import { getOwnedModule } from "./modules";

/** The registration QR rotates on a clock that starts when the module was created. */
function regClock(m: { createdAt: Date; regIntervalSec: number }): Clock {
  return { startedAtMs: m.createdAt.getTime(), intervalSec: m.regIntervalSec };
}

// ── Lecturer / projector ───────────────────────────────────────────────────

export async function registrationToken(lecturerId: string, moduleId: string) {
  const mod = await getOwnedModule(lecturerId, moduleId);
  if (!mod.registrationOpen) {
    throw ApiError.conflict("REGISTRATION_CLOSED", "Registration is closed. Open it to show the QR.");
  }
  return currentToken("R", mod.id, mod.regSecret, regClock(mod), Date.now());
}

export async function registrationLive(lecturerId: string, moduleId: string) {
  const mod = await getOwnedModule(lecturerId, moduleId);
  const startOfDay = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [total, registered, latest, failed] = await Promise.all([
    db.rosterEntry.count({ where: { moduleId } }),
    db.rosterEntry.count({ where: { moduleId, registeredAt: { not: null } } }),
    db.rosterEntry.findMany({
      where: { moduleId, registeredAt: { not: null } },
      orderBy: { registeredAt: "desc" },
      take: 8,
      select: { rosterName: true, registeredAt: true, student: { select: { indexNumber: true } } },
    }),
    db.registrationEvent.findMany({
      where: {
        moduleId,
        at: { gte: startOfDay },
        verdict: { in: ["NOT_ON_ROSTER", "NAME_MISMATCH", "DEVICE_BOUND_TO_OTHER_STUDENT", "STUDENT_HAS_OTHER_DEVICE", "BAD_SIGNATURE"] },
      },
      orderBy: { at: "desc" },
      take: 10,
      select: { id: true, indexNumberTyped: true, verdict: true, at: true },
    }),
  ]);
  return {
    open: mod.registrationOpen,
    total,
    registered,
    latest: latest.map((r) => ({ indexNumber: r.student.indexNumber, name: r.rosterName, at: r.registeredAt })),
    failed,
  };
}

// ── App ────────────────────────────────────────────────────────────────────

export const RegistrationInput = z.object({
  /** The QR text ("QA1:R:…") or the bare token. */
  token: z.string().min(1).max(200),
  indexNumber: z
    .string()
    .transform(normaliseIndex)
    .refine((s) => INDEX_RE.test(s), "Index must be 6 digits and a letter, e.g. 220366X.")
    .optional(),
  name: z.string().transform(cleanName).optional(),
  /** base64 DER signature of "QRv1-REG|token|deviceId|indexNumber" */
  signature: z.string().min(1).max(200),
});

type Device = { id: string; publicKey: string; studentId: string | null; student: { id: string; indexNumber: string } | null };

export type RegistrationResult = {
  verdict: RegistrationVerdict;
  message: string;
  module?: { id: string; displayName: string };
  student?: { indexNumber: string; name: string };
};

const MESSAGES: Record<RegistrationVerdict, string> = {
  REGISTERED: "You're registered for this module.",
  ALREADY_REGISTERED: "You're already registered for this module.",
  BAD_TOKEN: "That isn't a registration code. Scan the code on the projector.",
  EXPIRED: "That code has expired. Scan the code on the projector again.",
  BAD_SIGNATURE: "This phone couldn't prove it's yours. Set up the app again.",
  REGISTRATION_CLOSED: "Registration is closed. Ask your lecturer to open it.",
  NOT_ON_ROSTER: "Your index number is not on this module's list. Ask your lecturer to add you.",
  NAME_MISMATCH: "Name doesn't match the lecturer's list.",
  DEVICE_BOUND_TO_OTHER_STUDENT: "This phone is registered to another student.",
  STUDENT_HAS_OTHER_DEVICE: "You already registered another phone. Ask your lecturer to reset your device.",
};

/**
 * What the app shows right after scanning, before the student types or signs
 * anything: which module, and whether the code and registration are usable.
 */
export async function previewRegistration(device: Device, rawToken: string) {
  const token = stripPrefix("R", rawToken);
  const parsed = readToken(token);
  const mod = parsed
    ? await db.module.findUnique({ where: { id: parsed.id }, include: { lecturer: { select: { name: true } } } })
    : null;
  if (!mod) return { verdict: "BAD_TOKEN" as const, message: MESSAGES.BAD_TOKEN };
  const check = checkToken("R", token, mod.regSecret, regClock(mod), Date.now());
  if (!check.ok) return { verdict: check.verdict, message: MESSAGES[check.verdict] };

  const entry = device.studentId
    ? await db.rosterEntry.findUnique({
        where: { moduleId_studentId: { moduleId: mod.id, studentId: device.studentId } },
        select: { rosterName: true, registeredAt: true },
      })
    : null;
  return {
    verdict: mod.registrationOpen ? ("OK" as const) : ("REGISTRATION_CLOSED" as const),
    message: mod.registrationOpen ? "Registration is open for this module." : MESSAGES.REGISTRATION_CLOSED,
    module: {
      id: mod.id,
      displayName: moduleDisplayName(mod),
      shortName: `${mod.intake}-${mod.semester}-${mod.code}`,
      name: mod.name,
      lecturer: mod.lecturer.name,
    },
    /** For a bound phone: the name on this module's list, if the student is on it. */
    nameOnList: entry?.rosterName ?? null,
    alreadyRegistered: !!entry?.registeredAt,
    codeValidForSec: Math.max(0, Math.floor(((mod.regIntervalSec + GRACE_SEC) * 1000 - check.tokenAgeMs) / 1000)),
  };
}

export async function registerForModule(device: Device, input: z.infer<typeof RegistrationInput>): Promise<RegistrationResult> {
  const receivedAt = Date.now();
  const token = stripPrefix("R", input.token);
  const result = (verdict: RegistrationVerdict, extra: Omit<RegistrationResult, "verdict" | "message"> = {}) => ({
    verdict,
    message: MESSAGES[verdict],
    ...extra,
  });

  // 1. The token: right purpose, valid HMAC, fresh (server clock only).
  const parsed = readToken(token);
  const mod = parsed ? await db.module.findUnique({ where: { id: parsed.id } }) : null;
  if (!mod) return result("BAD_TOKEN");
  const check = checkToken("R", token, mod.regSecret, regClock(mod), receivedAt);
  if (!check.ok && check.verdict === "BAD_TOKEN") return result("BAD_TOKEN");

  const moduleInfo = { id: mod.id, displayName: moduleDisplayName(mod) };
  const indexForLog = input.indexNumber ?? device.student?.indexNumber ?? "";
  const log = (verdict: RegistrationVerdict) =>
    db.registrationEvent.create({ data: { moduleId: mod.id, deviceId: device.id, indexNumberTyped: indexForLog, verdict } });

  if (!check.ok) {
    await log("EXPIRED");
    return result("EXPIRED", { module: moduleInfo });
  }

  // 2. The signature, over the index this request is for.
  const signedIndex = input.indexNumber ?? device.student?.indexNumber;
  if (!signedIndex) throw ApiError.badRequest("Enter your index number and name.");
  if (!device.studentId && !input.name) throw ApiError.badRequest("Enter your name as it is on the class list.");
  const message = signedMessage.registration(token, device.id, signedIndex);
  if (!verifyDeviceSignature(device.publicKey, message, input.signature)) {
    await log("BAD_SIGNATURE");
    return result("BAD_SIGNATURE", { module: moduleInfo });
  }

  // 3. The roster rules.
  const student = await db.student.findUnique({ where: { indexNumber: signedIndex } });
  const roster = student
    ? await db.rosterEntry.findUnique({ where: { moduleId_studentId: { moduleId: mod.id, studentId: student.id } } })
    : null;
  const otherDevice = student
    ? await db.device.findFirst({ where: { studentId: student.id, status: "ACTIVE", NOT: { id: device.id } }, select: { id: true } })
    : null;

  const decision = decideRegistration({
    registrationOpen: mod.registrationOpen,
    deviceId: device.id,
    boundIndex: device.student?.indexNumber ?? null,
    typedIndex: input.indexNumber ?? null,
    typedName: input.name ?? null,
    roster,
    studentHasOtherDevice: !!otherDevice,
  });

  const studentInfo = roster ? { indexNumber: signedIndex, name: roster.rosterName } : undefined;
  if (decision.verdict !== "REGISTERED") {
    await log(decision.verdict);
    return result(decision.verdict, { module: moduleInfo, ...(studentInfo && decision.verdict === "ALREADY_REGISTERED" ? { student: studentInfo } : {}) });
  }

  // 4. Bind the phone (first module only) and mark the roster entry registered.
  try {
    await db.$transaction(async (tx) => {
      if (decision.bind) {
        // Only bind if still unbound: two scans at once must not bind twice.
        const bound = await tx.device.updateMany({
          where: { id: device.id, studentId: null, status: "ACTIVE" },
          data: { studentId: student!.id, boundAt: new Date() },
        });
        if (bound.count !== 1) throw new ApiError(409, "DEVICE_CHANGED", "Try again.");
      }
      await tx.rosterEntry.update({
        where: { id: roster!.id },
        data: { registeredAt: new Date(), registeredDeviceId: device.id },
      });
      await tx.registrationEvent.create({
        data: { moduleId: mod.id, deviceId: device.id, indexNumberTyped: indexForLog, verdict: "REGISTERED" },
      });
    });
  } catch (err) {
    // The partial unique index: the student got another active phone in the meantime.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      await log("STUDENT_HAS_OTHER_DEVICE");
      return result("STUDENT_HAS_OTHER_DEVICE", { module: moduleInfo });
    }
    throw err;
  }
  return result("REGISTERED", { module: moduleInfo, student: studentInfo });
}
