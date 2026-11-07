import { withAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** The signed-in address for the header; null when sign-in is off for local use. */
export async function GET() {
  if (!process.env.WORKOS_CLIENT_ID) return NextResponse.json({ email: null });
  const { user } = await withAuth();
  return NextResponse.json({ email: user?.email ?? null });
}
