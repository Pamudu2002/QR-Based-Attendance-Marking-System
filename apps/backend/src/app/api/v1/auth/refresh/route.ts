import { z } from "zod";
import { ApiError, handler } from "@/lib/http";
import { clearLecturerSession, rotateRefreshToken, setLecturerSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ACCESS_TTL_SEC, REFRESH_COOKIE, signAccessToken } from "@/lib/tokens";
import { safeNext } from "@/lib/safe-next";

const Body = z.object({ refreshToken: z.string().optional() }).default({});

/** Portal (cookie) or app (body) refresh. Returns a new token pair. */
export const POST = handler(async (req) => {
  const text = await req.text();
  let raw: unknown = {};
  if (text) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw ApiError.badRequest("The request body must be JSON.");
    }
  }
  const body = Body.parse(raw);
  const token = body.refreshToken ?? req.cookies.get(REFRESH_COOKIE)?.value;
  if (!token) throw ApiError.unauthorized();

  const rotated = await rotateRefreshToken(token);
  if ("deviceId" in rotated.owner) {
    // The app keeps its tokens itself, so they go back in the body.
    const device = await db.device.findUnique({ where: { id: rotated.owner.deviceId }, select: { status: true } });
    if (device?.status !== "ACTIVE") {
      throw new ApiError(403, "DEVICE_REVOKED", "This phone was reset by your lecturer. Set up the app again.");
    }
    return {
      accessToken: await signAccessToken({ sub: rotated.owner.deviceId, typ: "device" }),
      expiresInSec: ACCESS_TTL_SEC,
      refreshToken: rotated.refreshToken,
    };
  }
  await setLecturerSession(rotated.owner.lecturerId, rotated.refreshToken, rotated.persistent);
  return { ok: true };
});

/**
 * A relative redirect. `req.url` names the server's own host (localhost:3000 in
 * dev), so an absolute one would move a browser that came in on the LAN address
 * to localhost, where its cookies don't apply: a refresh/login loop.
 */
const redirectTo = (path: string) => new Response(null, { status: 307, headers: { Location: path } });

/** Browser redirect used by the proxy: refresh, then go back to `next`. */
export const GET = handler(async (req) => {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  const login = next === "/" ? "/login" : `/login?${new URLSearchParams({ next })}`;

  if (!raw) return redirectTo(login);
  try {
    const rotated = await rotateRefreshToken(raw);
    if (!("lecturerId" in rotated.owner)) return redirectTo(login);
    await setLecturerSession(rotated.owner.lecturerId, rotated.refreshToken, rotated.persistent);
    return redirectTo(next);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    await clearLecturerSession();
    return redirectTo(login);
  }
});
