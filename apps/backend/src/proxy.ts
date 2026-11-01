import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_COOKIE, verifyAccessToken } from "@/lib/tokens";

// Guards portal and projector pages. With no valid access token, the browser is
// sent through the refresh route (which can see the refresh cookie) and back.
export async function proxy(req: NextRequest) {
  const claims = await verifyAccessToken(req.cookies.get(ACCESS_COOKIE)?.value);
  if (claims?.typ === "lecturer") return NextResponse.next();

  const next = req.nextUrl.pathname + req.nextUrl.search;
  const url = new URL("/api/v1/auth/refresh", req.url);
  url.searchParams.set("next", next);
  return NextResponse.redirect(url);
}

export const config = {
  // Everything except the API, the auth pages and static files.
  matcher: ["/((?!api/|_next/|login|signup|favicon.ico|.*\.(?:svg|png|ico|txt|csv)$).*)"],
};
