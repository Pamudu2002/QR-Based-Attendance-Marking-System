import { handler } from "@/lib/http";
import { clearLecturerSession, revokeRefreshToken } from "@/lib/auth";
import { REFRESH_COOKIE } from "@/lib/tokens";

export const POST = handler(async (req) => {
  const raw = req.cookies.get(REFRESH_COOKIE)?.value;
  if (raw) await revokeRefreshToken(raw);
  await clearLecturerSession();
  return { ok: true };
});
