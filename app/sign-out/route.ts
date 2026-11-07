import { getWorkOS, withAuth } from "@workos-inc/authkit-nextjs";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * POST only, so a link or a prefetch cannot sign anyone out. The 303 makes the browser continue with a GET;
 * the library's signOut() redirects with a 307 from a route, which would repeat the POST at WorkOS.
 */
export async function POST(request: Request) {
  const home = new URL(process.env.NEXT_PUBLIC_WORKOS_REDIRECT_URI ?? request.url).origin;
  const { sessionId } = await withAuth();
  (await cookies()).delete(process.env.WORKOS_COOKIE_NAME || "wos-session");
  // an expired session has nothing to end at WorkOS
  const target = sessionId ? getWorkOS().userManagement.getLogoutUrl({ sessionId, returnTo: home }) : home;
  return NextResponse.redirect(target, 303);
}
