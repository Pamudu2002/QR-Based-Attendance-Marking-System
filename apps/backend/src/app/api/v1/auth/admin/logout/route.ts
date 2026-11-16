import { handler } from "@/lib/http";
import { clearAdminSession, revokeRefreshToken } from "@/lib/auth";
import { ADMIN_REFRESH_COOKIE } from "@/lib/tokens";

export const POST = handler(async (req) => {
  const raw = req.cookies.get(ADMIN_REFRESH_COOKIE)?.value;
  if (raw) await revokeRefreshToken(raw);
  await clearAdminSession();
  return { ok: true };
});
