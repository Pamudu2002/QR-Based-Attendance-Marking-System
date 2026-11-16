import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, ADMIN_ACCESS_COOKIE, verifyAccessToken } from "@/lib/tokens";

// Guards portal, admin and projector pages. With no valid access token, the browser
// is sent through the refresh route (which can see the refresh cookie) and back.
export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;
  const isAdmin = path === "/admin" || path.startsWith("/admin/");
  if (path === "/admin/login") return NextResponse.next();

  const cookie = isAdmin ? ADMIN_ACCESS_COOKIE : ACCESS_COOKIE;
  const claims = await verifyAccessToken(req.cookies.get(cookie)?.value);
  if (claims?.typ === (isAdmin ? "admin" : "lecturer")) return NextResponse.next();

  const url = new URL(isAdmin ? "/api/v1/auth/admin/refresh" : "/api/v1/auth/refresh", req.url);
  url.searchParams.set("next", path + req.nextUrl.search);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the API, the login page and static files.
  matcher: ["/((?!api/|_next/|login|favicon.ico|.*\.(?:svg|png|ico|txt|csv)$).*)"],
};
