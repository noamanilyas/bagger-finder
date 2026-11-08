import { NextResponse } from "next/server";
import { SOURCES } from "@/lib/config";
import { applyChange, loadSettings, saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await loadSettings());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Changes the settings it is given and keeps the others (see applyChange in lib/settings.ts). */
export async function POST(req: Request) {
  const body: unknown = await req.json().catch(() => null);
  try {
    const next = applyChange(await loadSettings(), body, SOURCES.map((s) => s.id));
    if (typeof next === "string") return NextResponse.json({ error: next }, { status: 400 });
    await saveSettings(next);
    return NextResponse.json(next);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
