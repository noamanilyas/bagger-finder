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
  // "55" must stand alone: not part of 225/55 R18, 300x55,5x82 or 1.755
  { key: "yanmar-55", label: "Yanmar 55", make: /yanmar/i, number: /(?<![\d/x,.])(?:vio|sv)?\s*-?\s*55(?!\d|[,.]\d)/i },
  { key: "doosan-dx55", label: "Doosan DX55", make: /do{1,2}san|daewoo/i, number: /dx\s*-?\s*55(?!\d)/i },
  { key: "doosan-dx140", label: "Doosan DX140", make: /do{1,2}san|daewoo/i, number: /dx\s*-?\s*140(?!\d)/i },
  { key: "hyundai-140", label: "Hyundai 140", make: /hyundai/i, number: /(?:robex|hx|(?<![a-z])r)\s*-?\s*140(?!\d)/i },
  { key: "hyundai-55", label: "Hyundai 55", make: /hyundai/i, number: /(?:robex|hx|(?<![a-z])r)\s*-?\s*55(?!\d)/i },
];

/** Never an excavator for sale: tyres, rubber tracks, parts, rentals, wanted ads. */
const HARD_EXCLUDE =
  /reifen|räder\b|felge|gummiketten?|gummipads?|laufrolle|ersatzteil|zahnrad|kühler|hydraulikpumpe|anhänger|vermiet|zu miete|mietbagger|gesuch|suche\s/i;
/** Parts that name an engine/cab: only excluded when the text does not call the thing an excavator. */
const SOFT_EXCLUDE = /motor\b|motoren|kabine|schlüssel|scheibe/i;

export function matchModel(text: string): WantedModel | null {
  if (HARD_EXCLUDE.test(text)) return null;
  if (SOFT_EXCLUDE.test(text) && !/bagger|excavator/i.test(text)) return null;
  for (const m of WANTED) {
    if (m.make.test(text) && m.number.test(text)) return m;
  }
  return null;
}

/** Listings located outside Germany are skipped ("available in Germany"). */
export const FOREIGN =
  /norwegen|tschechi|polen|niederlande|belgien|frankreich|italien|spanien|österreich|schweiz|dänemark|luxemburg|ungarn|rumänien|bulgarien|slowakei|slowenien|kroatien|litauen|lettland|estland|finnland|schweden|großbritannien|irland|portugal|griechenland|türkei|lithuania|poland|netherlands/i;

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
