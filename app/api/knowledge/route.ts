import { NextResponse } from "next/server";
import { WANTED } from "@/lib/config";
import { validateNote } from "@/lib/knowledge";
import { addKnowledge, removeKnowledge } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Who may change notes is settled by sign-in (see middleware.ts). */
function refused(req: Request): NextResponse | null {
  // A form on another website cannot send this type without the browser asking first.
  if (req.method === "POST" && !req.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Send JSON" }, { status: 415 });
  }
  return null;
}

export async function POST(req: Request) {
  const no = refused(req);
  if (no) return no;
  let note;
  try {
    note = validateNote(await req.json().catch(() => null), WANTED.map((w) => w.key));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  try {
    return NextResponse.json(await addKnowledge(note));
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const no = refused(req);
  if (no) return no;
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) return NextResponse.json({ error: "Which note?" }, { status: 400 });
  try {
    await removeKnowledge(id);
    return NextResponse.json({ removed: id });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
