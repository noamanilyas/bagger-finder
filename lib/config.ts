/**
 * What we look for and where we look. Edit this file to add models or sources.
 */

export type WantedModel = {
  key: string;
  label: string;
  /** all of these must match the listing text (title + make + model) */
  make: RegExp;
  number: RegExp;
};

export const WANTED: WantedModel[] = [
  { key: "yanmar-55", label: "Yanmar 55", make: /yanmar/i, number: /(?<!\d)55(?!\d)/ },
  { key: "doosan-dx55", label: "Doosan DX55", make: /do{1,2}san|daewoo/i, number: /\bdx\s*-?\s*55(?!\d)/i },
  { key: "doosan-dx140", label: "Doosan DX140", make: /do{1,2}san|daewoo/i, number: /\bdx\s*-?\s*140(?!\d)/i },
  { key: "hyundai-140", label: "Hyundai 140", make: /hyundai/i, number: /(?<!\d)140(?!\d)/ },
  { key: "hyundai-55", label: "Hyundai 55", make: /hyundai/i, number: /(?<!\d)55(?!\d)/ },
];

export function matchModel(text: string): WantedModel | null {
  for (const m of WANTED) {
    if (m.make.test(text) && m.number.test(text)) return m;
  }
  return null;
}

/** Cheap pre-filter so we only send plausible blocks to the AI. */
export function looksRelevant(text: string): boolean {
  return /yanmar|do{1,2}san|daewoo|hyundai/i.test(text) || /\bdx\s*-?\s*\d{2,3}/i.test(text);
}

export type Source = {
  id: string;
  name: string;
  enabled: boolean;
  /** search/listing page URLs to crawl for this source */
  urls: () => string[];
};

const plus = (q: string) => q.trim().replace(/\s+/g, "+");
const dash = (q: string) => q.trim().toLowerCase().replace(/\s+/g, "-");

/** Search phrases used on sources that have a free-text search URL. */
const QUERIES = [
  "yanmar vio 55",
  "yanmar sv 55",
  "doosan dx 55",
  "doosan dx 140",
  "hyundai r 55",
  "hyundai r 140",
  "hyundai hx 140",
];

export const SOURCES: Source[] = [
  {
    id: "maschinensucher",
    name: "Maschinensucher",
    enabled: true,
    urls: () => QUERIES.map((q) => `https://www.maschinensucher.de/mss/${plus(q)}`),
  },
  {
    id: "truckscout24",
    name: "TruckScout24",
    enabled: true,
    urls: () => [
      "https://www.truckscout24.de/baumaschinen/gebraucht/minibagger/yanmar",
      "https://www.truckscout24.de/baumaschinen/gebraucht/alle/doosan/dx",
      "https://www.truckscout24.de/baumaschinen/gebraucht/alle/hyundai",
    ],
  },
  {
    id: "kleinanzeigen",
    name: "Kleinanzeigen",
    enabled: true,
    urls: () => QUERIES.map((q) => `https://www.kleinanzeigen.de/s-${dash(q)}/k0`),
  },
  {
    // Not verified yet — enable and check the per-source result in the app header.
    id: "mascus",
    name: "Mascus",
    enabled: false,
    urls: () => QUERIES.map((q) => `https://www.mascus.de/search?q=${plus(q)}`),
  },
];
