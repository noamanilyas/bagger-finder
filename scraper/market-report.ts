/**
 * Prints the market comparison for the stored listings. Saves nothing.
 *   npm run market-report          numbers only, no AI
 *   npm run market-report -- --ai  also asks the free AI models about flagged machines
 */
import { applyMarket, isSaleAd, MIN_COMPARABLES } from "../lib/market";
import { hasSupabase, loadListings } from "../lib/supabase";
import { readDb } from "../lib/store";
import { checkFlagged } from "./check";

const eur = (n: number | null) => (n == null ? "-" : `€${n.toLocaleString("de-DE")}`);

async function main() {
  const stored = hasSupabase() ? await loadListings() : readDb().listings;
  const listings = applyMarket(stored);
  const sale = listings.filter(isSaleAd);
  const priced = sale.filter((l) => l.priceEur != null);
  console.log(`${stored.length} listings, ${priced.length} with a price`);

  const groups = new Map<string, typeof listings>();
  for (const l of sale) {
    const k = `${l.modelLabel} (${l.wheeled ? "wheeled" : "tracked/unknown"})`;
    groups.set(k, [...(groups.get(k) ?? []), l]);
  }
  console.log(`\nComparison coverage (needs ${MIN_COMPARABLES} comparable priced machines):`);
  for (const [k, v] of [...groups].sort()) {
    const compared = v.filter((l) => l.marketMedian != null);
    console.log(`  ${k}: ${v.length} ads, ${v.filter((l) => l.priceEur != null).length} priced, ${compared.length} compared, ${v.filter((l) => l.flagged).length} flagged`);
  }

  if (process.argv.includes("--ai")) {
    const r = await checkFlagged(listings);
    console.log(`\nAI: ${r.checked} checked, ${r.failed} failed, ${r.waiting} still waiting`);
  }

  const flagged = listings.filter((l) => l.flagged).sort((a, b) => (b.belowPct ?? 0) - (a.belowPct ?? 0));
  console.log(`\nFlagged: ${flagged.length}`);
  for (const l of flagged) {
    console.log(`\n${l.belowPct}% below | ${eur(l.priceEur)} vs median ${eur(l.marketMedian)} of ${l.marketCount} | ${l.year ?? "?"} | ${l.hours ?? "?"} h | ${l.source}`);
    console.log(`  ${l.title}`);
    console.log(`  ${l.url}`);
    if (l.aiVerdict) console.log(`  AI: ${l.aiVerdict} — ${l.aiReason}`);
  }
}

void main();
