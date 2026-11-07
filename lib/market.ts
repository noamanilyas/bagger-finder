import type { Listing } from "./types";

/** Fewer priced machines than this is not a market: no comparison is made. */
export const MIN_COMPARABLES = 5;
/** Flag a machine this many percent below the median of comparable machines. */
export const FLAG_BELOW_PCT = 25;
/** Prefer machines built within this many years; use the whole model when that leaves too few. */
const YEAR_BAND = 3;

export const isSaleAd = (l: Pick<Listing, "adType">) => l.adType == null || l.adType === "sale";

/** The same machine is often advertised on several sites; it must count once. */
const machineKey = (l: Listing) => `${l.modelKey}|${l.year ?? ""}|${l.hours ?? ""}|${l.priceEur ?? ""}`;

/**
 * Machines that appear on more than one site, to see how big the duplicate problem is. Only counts ads with a year,
 * hours and a price, because two ads that merely lack those are not the same machine.
 */
export function crossSiteDuplicates(listings: Listing[]): { machines: number; extraAds: number } {
  const sites = new Map<string, Set<string>>();
  const ads = new Map<string, number>();
  for (const l of listings) {
    if (l.year == null || l.hours == null || l.priceEur == null) continue;
    const key = machineKey(l);
    sites.set(key, (sites.get(key) ?? new Set()).add(l.source));
    ads.set(key, (ads.get(key) ?? 0) + 1);
  }
  let machines = 0;
  let extraAds = 0;
  for (const [key, where] of sites) {
    if (where.size < 2) continue;
    machines++;
    extraAds += ads.get(key)! - 1;
  }
  return { machines, extraAds };
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = s.length >> 1;
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Priced sale ads of the same model and type, each machine once, without the machine itself. */
function comparablesFor(l: Listing, all: Listing[]): Listing[] {
  const self = machineKey(l);
  const seen = new Set<string>();
  const out: Listing[] = [];
  for (const o of all) {
    if (o.modelKey !== l.modelKey || o.wheeled !== l.wheeled || o.priceEur == null || !isSaleAd(o)) continue;
    const key = machineKey(o);
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
  return listings.map((l) => {
    const none = { ...l, marketMedian: null, marketCount: null, belowPct: null, flagged: false };
    if (l.priceEur == null || !isSaleAd(l)) return none;
    const peers = comparablesFor(l, listings);
    if (peers.length < MIN_COMPARABLES) return none;
    const med = median(peers.map((p) => p.priceEur!));
    const belowPct = Math.round(((med - l.priceEur) / med) * 100);
    return { ...l, marketMedian: med, marketCount: peers.length, belowPct, flagged: belowPct >= FLAG_BELOW_PCT };
  });
}
