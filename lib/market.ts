import { machineOf } from "./duplicates";
import type { Listing } from "./types";

/** Fewer priced machines than this is not a market: no comparison is made. */
export const MIN_COMPARABLES = 5;
/** Flag a machine this many percent below the median of comparable machines. */
export const FLAG_BELOW_PCT = 25;
/** Prefer machines built within this many years; use the whole model when that leaves too few. */
const YEAR_BAND = 3;

export const isSaleAd = (l: Pick<Listing, "adType">) => l.adType == null || l.adType === "sale";

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Priced sale ads of the same model and type, each machine once, without the machine itself. */
function comparablesFor(l: Listing, all: Listing[], machine: Map<string, string>): Listing[] {
  const self = machine.get(l.id);
  const seen = new Set<string>();
  const out: Listing[] = [];
  for (const o of all) {
    if (o.modelKey !== l.modelKey || o.wheeled !== l.wheeled || o.priceEur == null || !isSaleAd(o)) continue;
    // The same machine is often advertised on several sites; it must count once (see lib/duplicates.ts).
    const key = machine.get(o.id)!;
    if (key === self || seen.has(key)) continue;
    seen.add(key);
    out.push(o);
  }
  if (l.year == null) return out;
  const near = out.filter((o) => o.year != null && Math.abs(o.year - l.year!) <= YEAR_BAND);
  return near.length >= MIN_COMPARABLES ? near : out;
}

/** Fills in the market fields. Only the numbers are decided here; AI verdicts are kept as they are. */
export function applyMarket(listings: Listing[]): Listing[] {
  const machine = machineOf(listings);
  return listings.map((l) => {
    const none = { ...l, marketMedian: null, marketCount: null, belowPct: null, flagged: false };
    if (l.priceEur == null || !isSaleAd(l)) return none;
    const peers = comparablesFor(l, listings, machine);
    if (peers.length < MIN_COMPARABLES) return none;
    const med = median(peers.map((p) => p.priceEur!));
    const belowPct = Math.round(((med - l.priceEur) / med) * 100);
    return { ...l, marketMedian: med, marketCount: peers.length, belowPct, flagged: belowPct >= FLAG_BELOW_PCT };
  });
}
