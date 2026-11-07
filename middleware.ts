import { NextResponse, type NextRequest } from "next/server";

/** With APP_PASSWORD set, the browser asks for it once (any user name). Without it the site is open, as for local use. */
export function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  // Render's health check (render.yaml) has no password.
  if (req.method === "GET" && req.nextUrl.pathname === "/api/health") return NextResponse.next();

  const [scheme, encoded] = (req.headers.get("authorization") ?? "").split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    if (decoded.slice(decoded.indexOf(":") + 1) === password) return NextResponse.next();
  }
  return new NextResponse("Password required", { status: 401, headers: { "WWW-Authenticate": 'Basic realm="Bagger Finder"' } });
}

export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico).*)" };
