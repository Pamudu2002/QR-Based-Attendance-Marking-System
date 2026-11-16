import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { redirect } from "next/navigation";
import { hash, verify } from "@node-rs/argon2";
import { db } from "./db";
import { env } from "./env";
import { ApiError } from "./http";
import {
  ACCESS_COOKIE,
  ACCESS_TTL_SEC,
  ADMIN_ACCESS_COOKIE,
  ADMIN_REFRESH_COOKIE,
  ADMIN_REFRESH_COOKIE_PATH,
  REFRESH_COOKIE,
  REFRESH_COOKIE_PATH,
  REFRESH_TTL_SEC,
  signAccessToken,
  verifyAccessToken,
} from "./tokens";

// ── Passwords ──────────────────────────────────────────────────────────────

export function hashPassword(password: string): Promise<string> {
  return hash(password); // argon2id with the library's defaults
}

export function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  return verify(passwordHash, password).catch(() => false);
}

// ── Refresh tokens ─────────────────────────────────────────────────────────

/** A rotated token presented again within this window is treated as a race, not theft. */
const REUSE_GRACE_MS = 20_000;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

type Owner = { lecturerId: string } | { adminId: string } | { deviceId: string };

export async function issueRefreshToken(owner: Owner, persistent: boolean, familyId?: string) {
  const raw = randomBytes(32).toString("base64url");
  await db.refreshToken.create({
    data: {
      ...owner,
      tokenHash: sha256(raw),
      familyId: familyId ?? randomBytes(16).toString("hex"),
      persistent,
      expiresAt: new Date(Date.now() + REFRESH_TTL_SEC * 1000),
    },
  });
  return raw;
}

/** Rotates a refresh token. Reusing an old token revokes its whole family. */
export async function rotateRefreshToken(raw: string) {
  const token = await db.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!token) throw ApiError.unauthorized();

  if (token.revokedAt) {
    // Within the grace window a rotated token still works, but only while its
    // successor is live. After logout the whole family is revoked, so it doesn't.
    const successorLive = await db.refreshToken.count({
      where: { familyId: token.familyId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (Date.now() - token.revokedAt.getTime() > REUSE_GRACE_MS || successorLive === 0) {
      await db.refreshToken.updateMany({
        where: { familyId: token.familyId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw ApiError.unauthorized();
    }
  } else {
    if (token.expiresAt.getTime() < Date.now()) throw ApiError.unauthorized();
    await db.refreshToken.update({ where: { id: token.id }, data: { revokedAt: new Date() } });
  }

  const owner: Owner = token.lecturerId
    ? { lecturerId: token.lecturerId }
    : token.adminId
      ? { adminId: token.adminId }
      : { deviceId: token.deviceId! };
  const next = await issueRefreshToken(owner, token.persistent, token.familyId);
  return { owner, refreshToken: next, persistent: token.persistent };
}

/** Logout: revokes the token and every other token in its family. */
export async function revokeRefreshToken(raw: string) {
  const token = await db.refreshToken.findUnique({ where: { tokenHash: sha256(raw) } });
  if (!token) return;
  await db.refreshToken.updateMany({
    where: { familyId: token.familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** Whether a refresh token was issued with "Keep me logged in" (true if unknown). */
export async function isPersistent(raw: string | undefined): Promise<boolean> {
  if (!raw) return true;
  const token = await db.refreshToken.findUnique({ where: { tokenHash: sha256(raw) }, select: { persistent: true } });
  return token?.persistent ?? true;
}

// ── Lecturer session cookies ───────────────────────────────────────────────

const cookieBase = () => ({ httpOnly: true, sameSite: "lax" as const, secure: env.isProduction() });

/** Sets the session cookies. The access token says whether a password change is due. */
export async function setLecturerSession(lecturerId: string, refreshToken: string, persistent: boolean) {
  const lecturer = await db.lecturer.findUnique({ where: { id: lecturerId }, select: { mustChangePassword: true } });
  if (!lecturer) throw ApiError.unauthorized();
  const jar = await cookies();
  const access = await signAccessToken({ sub: lecturerId, typ: "lecturer", pwc: lecturer.mustChangePassword });
  jar.set(ACCESS_COOKIE, access, { ...cookieBase(), path: "/", maxAge: ACCESS_TTL_SEC });
  jar.set(REFRESH_COOKIE, refreshToken, {
    ...cookieBase(),
    path: REFRESH_COOKIE_PATH,
    ...(persistent ? { maxAge: REFRESH_TTL_SEC } : {}),
  });
}

export async function clearLecturerSession() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.set(REFRESH_COOKIE, "", { path: REFRESH_COOKIE_PATH, maxAge: 0 });
}

/** Signs a lecturer out everywhere, e.g. after a password change or reset. */
export async function revokeLecturerSessions(lecturerId: string) {
  await db.refreshToken.updateMany({ where: { lecturerId, revokedAt: null }, data: { revokedAt: new Date() } });
}

export const PASSWORD_CHANGE_PATH = "/change-password";

type GateOptions = { allowPasswordChange?: boolean };

/**
 * For route handlers: the logged-in lecturer's id, or 401. A lecturer who still
 * has a temporary password gets 403 everywhere except the password change.
 */
export async function requireLecturerId(req: NextRequest, opts: GateOptions = {}): Promise<string> {
  const bearer = req.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
  const claims = await verifyAccessToken(bearer ?? req.cookies.get(ACCESS_COOKIE)?.value);
  if (!claims || claims.typ !== "lecturer") throw ApiError.unauthorized();
  if (claims.pwc && !opts.allowPasswordChange) {
    throw new ApiError(403, "PASSWORD_CHANGE_REQUIRED", "Set a new password to continue.");
  }
  return claims.sub;
}

/** For portal pages: the logged-in lecturer, or a redirect to the login or password change page. */
export async function requireLecturer(opts: GateOptions = {}) {
  const jar = await cookies();
  const claims = await verifyAccessToken(jar.get(ACCESS_COOKIE)?.value);
  if (!claims || claims.typ !== "lecturer") redirect("/login");
  if (claims.pwc && !opts.allowPasswordChange) redirect(PASSWORD_CHANGE_PATH);
  const lecturer = await db.lecturer.findUnique({
    where: { id: claims.sub },
    select: { id: true, name: true, email: true, mustChangePassword: true },
  });
  if (!lecturer) redirect("/login");
  return lecturer;
}

// ── Admin session cookies ──────────────────────────────────────────────────

export async function setAdminSession(adminId: string, refreshToken: string, persistent: boolean) {
  const jar = await cookies();
  jar.set(ADMIN_ACCESS_COOKIE, await signAccessToken({ sub: adminId, typ: "admin" }), {
    ...cookieBase(),
    path: "/",
    maxAge: ACCESS_TTL_SEC,
  });
  jar.set(ADMIN_REFRESH_COOKIE, refreshToken, {
    ...cookieBase(),
    path: ADMIN_REFRESH_COOKIE_PATH,
    ...(persistent ? { maxAge: REFRESH_TTL_SEC } : {}),
  });
}

export async function clearAdminSession() {
  const jar = await cookies();
  jar.delete(ADMIN_ACCESS_COOKIE);
  jar.set(ADMIN_REFRESH_COOKIE, "", { path: ADMIN_REFRESH_COOKIE_PATH, maxAge: 0 });
}

/** For admin route handlers: the logged-in admin's id, or 401. */
export async function requireAdminId(req: NextRequest): Promise<string> {
  const claims = await verifyAccessToken(req.cookies.get(ADMIN_ACCESS_COOKIE)?.value);
  if (!claims || claims.typ !== "admin") throw ApiError.unauthorized();
  return claims.sub;
}

/** For admin pages: the logged-in admin, or a redirect to the admin login page. */
export async function requireAdmin() {
  const jar = await cookies();
  const claims = await verifyAccessToken(jar.get(ADMIN_ACCESS_COOKIE)?.value);
  if (!claims || claims.typ !== "admin") redirect("/admin/login");
  const admin = await db.admin.findUnique({
    where: { id: claims.sub },
    select: { id: true, name: true, email: true },
  });
  if (!admin) redirect("/admin/login");
  return admin;
}
