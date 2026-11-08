import type { Currency } from "./currency";

export type AdType = "sale" | "rental" | "parts" | "other";
export type AiVerdict = "interesting" | "suspicious" | "not_comparable";

export type Listing = {
  id: string;
  url: string;
  source: string;
  title: string;
  description: string;
  make: string | null;
  model: string | null;
  /** key of the wanted model this listing matched (see lib/config.ts) */
  modelKey: string;
  modelLabel: string;
  /** wheeled excavator (Mobilbagger / Radbagger) */
  wheeled: boolean;
  priceEur: number | null;
  /** the price as the site shows it when that is not euros (see lib/currency.ts); priceEur is worked out from it */
  priceAmount?: number | null;
  priceCurrency?: Currency | null;
  year: number | null;
  hours: number | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  firstSeen: string;
  lastSeen: string;
  /** fingerprint of the ad card: an unchanged card is not sent to AI again */
  cardHash: string | null;
  cardText: string | null;
  /** set by AI; null means AI has not read this ad yet */
  adType: AdType | null;
  issues: string | null;
  priceNote: string | null;
  /** comparison with similar machines (see lib/market.ts); null when there are too few */
  marketMedian: number | null;
  marketCount: number | null;
  belowPct: number | null;
  flagged: boolean;
  aiVerdict: AiVerdict | null;
  aiReason: string | null;
  aiModel: string | null;
  aiCheckKey: string | null;
  /** the buyer's comments that match this ad (see lib/knowledge.ts); added when reading, not stored on the listing */
  knowledge?: { id: number; note: string; interesting: boolean; thisAdOnly: boolean }[];
};

/** The short id shown on cards and map popups, to name one listing. Unique in practice, and the search box finds it. */
export const shortId = (id: string) => id.slice(0, 8);

export type Db = {
  updatedAt: string | null;
  listings: Listing[];
};

export type SourceResult = {
  ok: boolean;
  pages: number;
  found: number;
  error?: string;
  /** the site refused the scraper this run (status code or bot check): it rests before it is asked again */
  blocked?: string;
  /** skipped this run because it is still resting after a block, until this time */
  restingUntil?: string;
  /** skipped this automatic run: it is read less often (scraper settings) and is next due at this time */
  notDueUntil?: string;
};

export type Status = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  message: string;
  /** progress of the running scrape */
  pagesDone?: number;
  pagesTotal?: number;
  /** when the scraper last reported real progress: used to spot a hung run */
  lastActivity?: string;
  extractor: "ai" | "heuristic" | null;
  sources: Record<string, SourceResult>;
};

export const emptyStatus: Status = {
  running: false,
  startedAt: null,
  finishedAt: null,
  message: "No scrape has run yet.",
  extractor: null,
  sources: {},
};
