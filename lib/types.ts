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
  priceEur: number | null;
  year: number | null;
  hours: number | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  firstSeen: string;
  lastSeen: string;
};

export type Db = {
  updatedAt: string | null;
  listings: Listing[];
};

export type SourceResult = {
  ok: boolean;
  pages: number;
  found: number;
  error?: string;
};

export type Status = {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  message: string;
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
