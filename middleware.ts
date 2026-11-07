import { applyResponseHeaders, authkit, handleAuthkitHeaders, partitionAuthkitHeaders } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest } from "next/server";
import { isAllowedUser, parseAllowedEmails } from "@/lib/auth";

/** The sign-in flow itself, and the page for a signed-in account that is not on ALLOWED_EMAILS. */
const OPEN_PATHS = new Set(["/callback", "/sign-in", "/sign-out", "/not-allowed"]);

/**
 * Sign-in with WorkOS for the whole site, limited to ALLOWED_EMAILS.
 * Without WORKOS_CLIENT_ID the site is open for local use, but production refuses every request rather than open up.
 */
export default async function middleware(request: NextRequest) {
  if (!process.env.WORKOS_CLIENT_ID) {
    if (process.env.NODE_ENV === "production") return new NextResponse("Sign-in is not configured", { status: 503 });
    return NextResponse.next();
  }

  const { session, headers, authorizationUrl } = await authkit(request);
  const { pathname } = request.nextUrl;
  if (OPEN_PATHS.has(pathname)) return handleAuthkitHeaders(request, headers);

  // fetch() from the page needs a status, not a redirect to the sign-in page
  const refuse = (status: number, error: string) => {
    const response = NextResponse.json({ error }, { status });
    applyResponseHeaders(response, partitionAuthkitHeaders(request, headers).responseHeaders);
    return response;
  };
  const isApi = pathname.startsWith("/api/");

  if (!session.user) {
    if (isApi) return refuse(401, "Sign in first");
    return handleAuthkitHeaders(request, headers, { redirect: authorizationUrl ?? "/sign-in" });
  }
  if (!isAllowedUser(session.user, parseAllowedEmails(process.env.ALLOWED_EMAILS))) {
    if (isApi) return refuse(403, "This account has no access");
    return handleAuthkitHeaders(request, headers, { redirect: "/not-allowed" });
  }
  return handleAuthkitHeaders(request, headers);
}

// Render's health check (render.yaml) has no session.
export const config = { matcher: "/((?!_next/static|_next/image|favicon.ico|api/health).*)" };
