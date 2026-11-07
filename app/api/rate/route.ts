import { NextResponse } from "next/server";
import { getPkrRate } from "@/lib/fx";

export const dynamic = "force-dynamic";

export async function GET() {
  const rate = await getPkrRate();
  if (!rate) return NextResponse.json({ error: "No exchange rate available" }, { status: 503 });
  return NextResponse.json(rate);
}
