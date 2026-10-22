import { NextResponse } from "next/server";
import { triggerScrape } from "@/lib/trigger";

export const dynamic = "force-dynamic";

export function POST() {
  const result = triggerScrape("manual");
  return NextResponse.json(result, { status: result.started ? 202 : 429 });
}
