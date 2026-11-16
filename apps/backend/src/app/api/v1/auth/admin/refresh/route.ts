import { ApiError, handler } from "@/lib/http";
import { clearAdminSession, rotateRefreshToken, setAdminSession } from "@/lib/auth";
import { ADMIN_REFRESH_COOKIE } from "@/lib/tokens";
import { safeNext } from "@/lib/safe-next";

/** Rotates the admin refresh cookie. Tokens that belong to anyone else are refused. */
async function rotateAdmin(raw: string) {
  const rotated = await rotateRefreshToken(raw);
  if (!("adminId" in rotated.owner)) throw ApiError.unauthorized();
  await setAdminSession(rotated.owner.adminId, rotated.refreshToken, rotated.persistent);
}

/** Admin portal (cookie) refresh. */
export const POST = handler(async (req) => {
  const raw = req.cookies.get(ADMIN_REFRESH_COOKIE)?.value;
  if (!raw) throw ApiError.unauthorized();
  await rotateAdmin(raw);
  return { ok: true };
});

/** Relative redirect, as in the lecturer refresh route (keeps the browser on its own host). */
const redirectTo = (path: string) => new Response(null, { status: 307, headers: { Location: path } });

/** Browser redirect used by the proxy: refresh, then go back to `next` (an admin page). */
export const GET = handler(async (req) => {
  const wanted = safeNext(req.nextUrl.searchParams.get("next"), "/admin");
  const next = wanted.startsWith("/admin") ? wanted : "/admin";
  const login = next === "/admin" ? "/admin/login" : `/admin/login?${new URLSearchParams({ next })}`;

  const raw = req.cookies.get(ADMIN_REFRESH_COOKIE)?.value;
  if (!raw) return redirectTo(login);
  try {
    await rotateAdmin(raw);
    return redirectTo(next);
  } catch (err) {
    if (!(err instanceof ApiError)) throw err;
    await clearAdminSession();
    return redirectTo(login);
  }
});
