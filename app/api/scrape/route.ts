import { NextResponse } from "next/server";
import { parseLimits } from "@/lib/config";
import { triggerScrape } from "@/lib/trigger";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  const result = await triggerScrape("manual", parseLimits(body));
  return NextResponse.json(result, { status: result.started ? 202 : 429 });
}
