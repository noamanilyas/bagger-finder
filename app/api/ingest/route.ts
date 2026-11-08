import { NextResponse, type NextRequest } from "next/server";
import { ingestMachines, MAX_MACHINES_PER_REQUEST } from "@/lib/ingest";

export const dynamic = "force-dynamic";

/**
 * For an external system that sends machines to store like scraped ones (see README).
 *
 *   POST /api/ingest
 *   { "site": "mobile.de", "machines": [ { "url": "...", "title": "...", ... } ] }   (or a bare array, or one machine)
 *
 * `site` is optional: it marks that site as extracted (GET /api/ingest/due), also with an empty list of machines.
 */
export async function POST(request: NextRequest) {
  // No key check for now: anyone who can reach the server can send machines. To require INGEST_API_KEY again:
  //   const refused = checkIngestKey(request.headers);   (from @/lib/ingest-auth)
  //   if (refused) return NextResponse.json({ error: refused.error }, { status: refused.status });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The body must be JSON" }, { status: 400 });
  }
  const wrapped = body && typeof body === "object" && !Array.isArray(body) && Array.isArray((body as { machines?: unknown }).machines);
  const machines = Array.isArray(body) ? body : wrapped ? (body as { machines: unknown[] }).machines : [body];
  const site = wrapped && typeof (body as { site?: unknown }).site === "string" ? (body as { site: string }).site : null;
  if (machines.length === 0 && !site) return NextResponse.json({ error: "No machines sent" }, { status: 400 });
  if (machines.length > MAX_MACHINES_PER_REQUEST) {
    return NextResponse.json({ error: `At most ${MAX_MACHINES_PER_REQUEST} machines per request` }, { status: 413 });
  }

  try {
    const result = await ingestMachines(machines, site);
    return NextResponse.json({ storedCount: result.stored.length, rejectedCount: result.rejected.length, ...result });
  } catch (err) {
    console.error(`[ingest] ${(err as Error).message}`);
    return NextResponse.json({ error: `Could not store the machines: ${(err as Error).message}` }, { status: 500 });
  }
}
