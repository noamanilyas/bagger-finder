import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/** For Render's health check, which has no password. Says nothing about the data. */
export function GET() {
  return NextResponse.json({ ok: true });
}
