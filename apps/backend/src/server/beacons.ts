import "server-only";
import { randomBytes } from "node:crypto";
import type { NextRequest } from "next/server";
import { jwtVerify, SignJWT } from "jose";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { BEACON_ROTATE_SEC, beaconKey } from "@/lib/beacon";
import { db } from "@/lib/db";
import { parseDevicePublicKey, signedMessage, verifyDeviceSignature } from "@/lib/device-crypto";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/http";
import { moduleDisplayName } from "@/lib/identity";
import { verifyAccessToken } from "@/lib/tokens";
import { DeviceInput } from "./student-app";
import { beaconStatus } from "./checkin";

// Classroom beacon phones (PLAN §6.5): a lecturer's Android phone running
// CSE Attendance Beacon. Linked once with a QR from the portal, then it polls
// /beacon/current and broadcasts while one of the lecturer's check-ins is open.

export const BEACON_QR_PREFIX = "QA1:B:";
const LINK_TTL_SEC = 120;

// ── Lecturer (portal) ──────────────────────────────────────────────────────

/** A one-time link code, shown as a QR. Short-lived: anyone who scans it gets this lecturer's beacon. */
export async function beaconLinkCode(lecturerId: string) {
  const code = await new SignJWT({ typ: "beacon-link" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(lecturerId)
    .setJti(randomBytes(12).toString("base64url"))
    .setIssuedAt()
    .setExpirationTime(`${LINK_TTL_SEC}s`)
    .sign(env.jwtSecret());
  return { qr: BEACON_QR_PREFIX + code, expiresAt: new Date(Date.now() + LINK_TTL_SEC * 1000) };
}

export async function listBeaconPhones(lecturerId: string) {
  const [phones, status] = await Promise.all([
    db.beaconPhone.findMany({
      where: { lecturerId },
      orderBy: { createdAt: "asc" },
      select: { id: true, model: true, manufacturer: true, androidSdk: true, keyLevel: true, createdAt: true },
    }),
    beaconStatus(lecturerId),
  ]);
  return phones.map((p) => ({ ...p, ...status.find((s) => s.id === p.id)! }));
}

export async function removeBeaconPhone(lecturerId: string, id: string) {
  const { count } = await db.beaconPhone.deleteMany({ where: { id, lecturerId } });
  if (!count) throw ApiError.notFound("That beacon phone isn't linked to you.");
}

// ── Beacon phone (CSE Attendance Beacon) ───────────────────────────────────

export const BeaconLinkInput = DeviceInput.omit({ label: true }).extend({
  /** The QR text ("QA1:B:…") or the bare code. */
  code: z.string().min(1).max(2000),
  /** base64 DER signature of "QRv1-BEACON-LINK|code", made with the new key (proves the phone holds it) */
  signature: z.string().min(1).max(200),
});

export async function linkBeaconPhone(input: z.infer<typeof BeaconLinkInput>) {
  const code = input.code.trim().replace(BEACON_QR_PREFIX, "");
  let lecturerId: string;
  let pairingId: string;
  try {
    const { payload } = await jwtVerify(code, env.jwtSecret(), { algorithms: ["HS256"] });
    if (payload.typ !== "beacon-link" || typeof payload.sub !== "string" || typeof payload.jti !== "string") throw new Error();
    lecturerId = payload.sub;
    pairingId = payload.jti;
  } catch {
    throw new ApiError(400, "BAD_LINK_CODE", "That link code has expired or isn't a beacon link code. Show a new one in the portal.");
  }
  const publicKey = input.publicKey.replace(/\s+/g, "");
  if (!parseDevicePublicKey(publicKey)) throw ApiError.badRequest("The public key must be an EC P-256 key in X.509 SubjectPublicKeyInfo DER, base64.");
  if (!verifyDeviceSignature(publicKey, signedMessage.beaconLink(code), input.signature)) {
    throw new ApiError(401, "BAD_SIGNATURE", "This phone couldn't prove it holds its key. Try again.");
  }
  try {
    const phone = await db.beaconPhone.create({
      data: {
        lecturerId,
        pairingId,
        publicKey,
        keyLevel: input.keyLevel,
        model: input.model,
        manufacturer: input.manufacturer,
        androidSdk: input.androidSdk,
      },
      select: { id: true, lecturer: { select: { name: true } } },
    });
    return { beaconId: phone.id, lecturer: phone.lecturer.name };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      throw ApiError.conflict("LINK_CODE_USED", "That link code was already used. Show a new one in the portal.");
    }
    throw err;
  }
}

/** The calling beacon phone from its access JWT. 401 UNLINKED once the lecturer removes it. */
export async function requireBeaconPhone(req: NextRequest) {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const claims = await verifyAccessToken(bearer);
  if (!claims || claims.typ !== "beacon") throw ApiError.unauthorized("Log in again from the beacon app.");
  const phone = await db.beaconPhone.findUnique({ where: { id: claims.sub }, include: { lecturer: { select: { name: true } } } });
  if (!phone) throw new ApiError(401, "UNLINKED", "This phone was removed from your beacon phones. Link it again in the portal.");
  return phone;
}

export const BEACON_STATES = ["waiting", "broadcasting", "bluetooth_off", "no_permission", "cant_broadcast"] as const;

/**
 * Polled every 2 s. Records that the phone is alive, and returns the run to
 * broadcast for: the lecturer's latest open check-in, while its session is on
 * (experiment sessions any time). The phone gets the derived beacon key only.
 */
export async function beaconCurrent(phone: { id: string; lecturerId: string; lecturer: { name: string } }, state: string | null) {
  const now = new Date();
  await db.beaconPhone.update({
    where: { id: phone.id },
    data: { lastSeenAt: now, lastState: BEACON_STATES.includes(state as never) ? state : null },
  });
  const window = await db.checkinWindow.findFirst({
    where: {
      endedAt: null,
      session: { module: { lecturerId: phone.lecturerId }, OR: [{ isExperiment: true }, { endsAt: { gte: now } }] },
    },
    orderBy: { startedAt: "desc" },
    include: { session: { include: { module: true } } },
  });
  return {
    serverTime: now,
    lecturer: phone.lecturer.name,
    run: window
      ? {
          windowId: window.id,
          key: beaconKey(window.secret).toString("base64"),
          startedAt: window.startedAt,
          rotateSec: BEACON_ROTATE_SEC,
          mode: window.mode,
          requireBeacon: window.requireBeacon,
          session: { title: window.session.title, venue: window.session.venue },
          module: { code: window.session.module.code, displayName: moduleDisplayName(window.session.module) },
        }
      : null,
  };
}
