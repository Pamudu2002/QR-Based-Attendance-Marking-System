import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, handler } from "@/lib/http";
import { clearLecturerSession, rotateRefreshToken, setLecturerSession } from "@/lib/auth";
import { REFRESH_COOKIE } from "@/lib/tokens";
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
  if (!("lecturerId" in rotated.owner)) {
    // Device tokens are handled by the app's own auth routes (week 2).
    throw ApiError.unauthorized();
  }
  await setLecturerSession(rotated.owner.lecturerId, rotated.refreshToken, rotated.persistent);
  return { ok: true };
});

/** Browser redirect used by the proxy: refresh, then go back to `next`. */
export const GET = handler(async (req) => {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  const login = new URL("/login", req.url);
  if (next !== "/") login.searchParams.set("next", next);

  if (!raw) return NextResponse.redirect(login);
  try {
    const rotated = await rotateRefreshToken(raw);
    if (!("lecturerId" in rotated.owner)) return NextResponse.redirect(login);
    await setLecturerSession(rotated.owner.lecturerId, rotated.refreshToken, rotated.persistent);
    return NextResponse.redirect(new URL(next, req.url));
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    await clearLecturerSession();
    return NextResponse.redirect(login);
  }
});
