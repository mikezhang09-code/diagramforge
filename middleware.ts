import { NextRequest, NextResponse } from "next/server";

// Shared-password gate (HTTP Basic Auth) for protecting the whole app while it's
// exposed publicly (e.g. via a Cloudflare quick tunnel). The browser caches the
// credential per origin, so the page, /api/* routes, and the embedded /drawio
// editor are all covered after a single prompt.
//
// The password is APP_PASSWORD (set it in .env / the environment). A default is
// used if unset so the gate is always on; don't rely on the default in public.
const PASSWORD = process.env.APP_PASSWORD || "diagramforge";

export function middleware(req: NextRequest) {
  const header = req.headers.get("authorization");

  if (header?.startsWith("Basic ")) {
    let decoded = "";
    try {
      decoded = atob(header.slice(6));
    } catch {
      decoded = "";
    }
    // Accept any username; only the password must match.
    const password = decoded.slice(decoded.indexOf(":") + 1);
    if (password === PASSWORD) return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="DiagramForge", charset="UTF-8"',
    },
  });
}

export const config = {
  // Gate everything except Next's internal build assets.
  matcher: ["/((?!_next/).*)"],
};
