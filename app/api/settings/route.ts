import { NextResponse } from "next/server";
import { loadSettings, saveSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await loadSettings());
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { mobileOnly?: unknown } | null;
  if (typeof body?.mobileOnly !== "boolean") return NextResponse.json({ error: "mobileOnly must be true or false." }, { status: 400 });
  try {
    const settings = { mobileOnly: body.mobileOnly };
    await saveSettings(settings);
    return NextResponse.json(settings);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
