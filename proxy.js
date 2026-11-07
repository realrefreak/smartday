// Runs before matching requests reach a page (Next.js 16 calls this "proxy";
// older versions called it "middleware").
//
// This is only a quick, OPTIMISTIC check: "is there a session cookie at all?"
// It doesn't ask the database whether the session is real or still valid; the
// page does that with requireUser(). The proxy just saves a wasted page render
// for visitors who are clearly logged out.

import { NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  return NextResponse.next();
}

export const config = {
  // Pages that require login. ":path*" also covers anything under them.
  matcher: ["/tasks/:path*", "/calendar/:path*", "/review/:path*", "/account/:path*"],
};
