import { isSaleAd } from "./market";
import type { Listing } from "./types";

/** The newest history row of a listing: all that is needed to spot a change. */
export type HistoryHead = {
  id: number;
  listingId: string;
  priceEur: number | null;
  hours: number | null;
  /** the price in the site's own currency; undefined when the database has no such column yet */
  priceAmount?: number | null;
};

/** Below this, a change in the euro value of a price in another currency is the exchange rate moving, not the seller. */
const RATE_NOISE = 0.03;

/**
 * A changed price. For prices in another currency the seller's own amount counts: the euro value moves with the rate
 * every day, and that is no change. Without the stored amount, only a move larger than the rate's daily wobble counts.
 */
export function priceChanged(l: Pick<Listing, "priceEur" | "priceAmount" | "priceCurrency">, head: HistoryHead): boolean {
  if (l.priceCurrency && l.priceAmount != null) {
    if (head.priceAmount != null) return l.priceAmount !== head.priceAmount;
    if (l.priceEur == null || head.priceEur == null) return false;
    return Math.abs(l.priceEur - head.priceEur) > head.priceEur * RATE_NOISE;
  }
  return l.priceEur != null && l.priceEur !== head.priceEur;
}

export type HistoryPlan = {
  /** first appearance, or a changed price or hours */
  insert: { listing: Listing; firstSeen: string; lastSeen: string }[];
  /** seen again unchanged: only last_seen moves */
  touch: number[];
  /** read as parts or rental after being stored as unread: these do not belong in the history */
  remove: string[];
};

/**
 * Decides what to write. A value that went missing is not a change: it usually means one parser
 * read less than another, not that the seller removed it.
 */
export function planHistory(listings: Listing[], heads: HistoryHead[], now: string): HistoryPlan {
  const headOf = new Map(heads.map((h) => [h.listingId, h]));
  const plan: HistoryPlan = { insert: [], touch: [], remove: [] };
  for (const l of listings) {
    const head = headOf.get(l.id);
    if (!isSaleAd(l)) {
      if (head) plan.remove.push(l.id);
      continue;
    }
    if (!head) {
      plan.insert.push({ listing: l, firstSeen: l.firstSeen, lastSeen: l.lastSeen });
      continue;
    }
    if (l.lastSeen !== now) continue; // not on the sites this time
    const changed = priceChanged(l, head) || (l.hours != null && l.hours !== head.hours);
    if (changed) plan.insert.push({ listing: l, firstSeen: now, lastSeen: now });
    else plan.touch.push(head.id);
  }
  return plan;
}
