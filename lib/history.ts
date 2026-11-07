import { isSaleAd } from "./market";
import type { Listing } from "./types";

/** The newest history row of a listing: all that is needed to spot a change. */
export type HistoryHead = { id: number; listingId: string; priceEur: number | null; hours: number | null };

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
    const changed = (l.priceEur != null && l.priceEur !== head.priceEur) || (l.hours != null && l.hours !== head.hours);
    if (changed) plan.insert.push({ listing: l, firstSeen: now, lastSeen: now });
    else plan.touch.push(head.id);
  }
  return plan;
}
