import { NextResponse } from "next/server";
import { readDb, readStatus } from "@/lib/store";
import { isRunning } from "@/lib/trigger";
import { WANTED } from "@/lib/config";

export const dynamic = "force-dynamic";

export function GET() {
  const db = readDb();
  const status = readStatus();
  return NextResponse.json({
    updatedAt: db.updatedAt,
    listings: db.listings,
    models: WANTED.map((m) => ({ key: m.key, label: m.label })),
    status: { ...status, running: isRunning() },
  });
}
