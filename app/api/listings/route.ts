import { NextResponse } from "next/server";
import { readDb, readStatus } from "@/lib/store";
import { getSchedule } from "@/lib/scheduler";
import { isRunning } from "@/lib/trigger";
import { hasSupabase, loadKnowledge, loadListings } from "@/lib/supabase";
import { isSaleAd } from "@/lib/market";
import { withKnowledge } from "@/lib/knowledge";
import { oneCardPerMachine } from "@/lib/duplicates";
import { WANTED } from "@/lib/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = readDb();
  let listings = db.listings;
  if (hasSupabase()) {
    try {
      listings = await loadListings();
    } catch (e) {
      console.warn(`[api] ${(e as Error).message} — using local copy`);
    }
  }
  const status = readStatus();
  return NextResponse.json({
    updatedAt: db.updatedAt,
    // Rentals and parts stay stored, so AI does not read them again, but are not shown.
    // A machine advertised on several sites is one card, with links to the other ads.
    listings: oneCardPerMachine(withKnowledge(listings.filter(isSaleAd), await loadKnowledge())),
    models: WANTED.map((m) => ({ key: m.key, label: m.label })),
    status: { ...status, running: isRunning() },
    schedule: await getSchedule(),
  });
}
