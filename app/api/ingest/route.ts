import crypto from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { ingestMachines, MAX_MACHINES_PER_REQUEST } from "@/lib/ingest";

export const dynamic = "force-dynamic";

/**
 * For an external system that sends machines to store like scraped ones. It has no sign-in session, so the
 * middleware lets this path through and the key in INGEST_API_KEY is checked here instead.
 *
 *   POST /api/ingest
 *   Authorization: Bearer <INGEST_API_KEY>      (or X-API-Key: <INGEST_API_KEY>)
 *   { "machines": [ { "url": "...", "title": "...", ... } ] }   (or a bare array, or one machine)
 */
function keyIsValid(request: NextRequest): boolean {
  const expected = process.env.INGEST_API_KEY;
  if (!expected || expected.length < 16) return false;
  const given = request.headers.get("x-api-key") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const hash = (s: string) => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(hash(given), hash(expected));
}

export async function POST(request: NextRequest) {
  if (!process.env.INGEST_API_KEY) return NextResponse.json({ error: "The ingest API is not configured (INGEST_API_KEY)" }, { status: 503 });
  if (!keyIsValid(request)) return NextResponse.json({ error: "Missing or wrong API key" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The body must be JSON" }, { status: 400 });
  }
  const machines = Array.isArray(body)
    ? body
    : body && typeof body === "object" && Array.isArray((body as { machines?: unknown }).machines)
      ? (body as { machines: unknown[] }).machines
      : [body];
  if (machines.length === 0) return NextResponse.json({ error: "No machines sent" }, { status: 400 });
  if (machines.length > MAX_MACHINES_PER_REQUEST) {
    return NextResponse.json({ error: `At most ${MAX_MACHINES_PER_REQUEST} machines per request` }, { status: 413 });
  }

  try {
    const result = await ingestMachines(machines);
    return NextResponse.json({ storedCount: result.stored.length, rejectedCount: result.rejected.length, ...result });
  } catch (err) {
    console.error(`[ingest] ${(err as Error).message}`);
    return NextResponse.json({ error: `Could not store the machines: ${(err as Error).message}` }, { status: 500 });
  }
}
