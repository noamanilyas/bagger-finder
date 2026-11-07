import { NextResponse } from "next/server";
import { isIntervalChoice } from "@/lib/schedule";
import { loadSettings, saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await loadSettings());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

/** Changes the settings it is given and keeps the others. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { mobileOnly?: unknown; intervalMinutes?: unknown } | null;
  const { mobileOnly, intervalMinutes } = body ?? {};
  if (mobileOnly === undefined && intervalMinutes === undefined) {
    return NextResponse.json({ error: "Nothing to change" }, { status: 400 });
  }
  if (mobileOnly !== undefined && typeof mobileOnly !== "boolean") {
    return NextResponse.json({ error: "mobileOnly must be true or false" }, { status: 400 });
  }
  if (intervalMinutes !== undefined && !isIntervalChoice(intervalMinutes)) {
    return NextResponse.json({ error: "intervalMinutes is not one of the choices" }, { status: 400 });
  }
  try {
    const settings = await loadSettings();
    if (mobileOnly !== undefined) settings.mobileOnly = mobileOnly;
    if (intervalMinutes !== undefined) settings.intervalMinutes = intervalMinutes;
    await saveSettings(settings);
    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
