import { NextResponse, type NextRequest } from "next/server";
import { loadLastReceived } from "@/lib/external-received";
import { siteDue } from "@/lib/external-sites";
import { loadSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/**
 * Asked by the external system before it extracts: should it extract these sites now?
 *
 *   GET /api/ingest/due?sites=mobile.de,abc.com     (or ?site=mobile.de; without either, every listed site)
 *   → { "due": true, "sites": [ { "site": "mobile.de", "due": true, ... }, { "site": "abc.com", "due": false, ... } ] }
 *
 * A site is due when it was never received or its interval has passed since it last was. A site that is not on the
 * list (Scraper settings → External sites) is never due. The top-level `due` is true when any site asked about is.
 */
export async function GET(request: NextRequest) {
  // No key check for now (see app/api/ingest/route.ts for how to turn it back on).
  try {
    const { externalSites } = await loadSettings();
    const params = request.nextUrl.searchParams;
    const asked = [...params.getAll("sites"), ...params.getAll("site")]
      .flatMap((v) => v.split(","))
      .map((v) => v.trim())
      .filter(Boolean);
    const names = asked.length > 0 ? [...new Set(asked)] : externalSites.map((s) => s.site);
    const lastReceived = await loadLastReceived();
    const sites = names.map((name) => siteDue(name, externalSites, lastReceived));
    return NextResponse.json({ due: sites.some((s) => s.due), checkedAt: new Date().toISOString(), sites });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
