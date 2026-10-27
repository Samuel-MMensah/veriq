// Rule D2: ?demo=1 turns demo mode on for the screens that follow (a cookie, as long as a demo
// login), and ?demo=0 turns it off (also on the demo deployment, which otherwise opens in demo mode).
// Nothing else happens here.
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_COOKIE, DEMO_COOKIE_HOURS } from "@/lib/demo/mode";

export function proxy(request: NextRequest) {
  const demo = request.nextUrl.searchParams.get("demo");
  const response = NextResponse.next();
  if (demo === "1") {
    response.cookies.set(DEMO_COOKIE, "1", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: DEMO_COOKIE_HOURS * 60 * 60,
      secure: request.nextUrl.protocol === "https:",
    });
  } else if (demo === "0") {
    // "0", not deleted: on the demo deployment (which opens in demo mode) it keeps later screens real.
    response.cookies.set(DEMO_COOKIE, "0", {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: DEMO_COOKIE_HOURS * 60 * 60,
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return response;
}

export const config = {
  // Pages and the USSD route only: not Next.js files, icons or the manifest.
  matcher: ["/((?!_next/|icon|manifest|favicon).*)"],
};
