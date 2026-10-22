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

/** Wheeled excavator (Mobilbagger): by category page hint, by the word, or by a "W" model suffix (DX55W, R140W-9, Robex 55W). */
export function isWheeled(text: string, hint = false): boolean {
  return (
    hint ||
    /mobilbagger|radbagger|mobile excavator|wheel(?:ed)? excavator|(?:dx|robex|hx|r|b|sv)\s*-?\s*\d{2,3}\s*-?\s*w(?![a-z])/i.test(text)
  );
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
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/**
 * Maschinensucher searches by model name ("make model [suffix]"), so besides the plain model we also
 * try the common suffixes (LC/LCR crawler, W wheeled, R) that have their own result pages.
 */
const MASCHINENSUCHER_QUERIES = [
  "yanmar vio 55",
  "yanmar sv 55",
  "doosan dx 55",
  "doosan dx 55 w",
  "doosan dx 55 r",
  "doosan dx 140",
  "doosan dx 140 lc",
  "doosan dx 140 lcr",
  "doosan dx 140 w",
  "hyundai r 55",
  "hyundai r 55 w",
  "hyundai robex 55",
  "hyundai robex 55 w",
  "hyundai r 140",
  "hyundai r 140 lc",
  "hyundai r 140 w",
  "hyundai robex 140",
  "hyundai robex 140 w",
  "hyundai hx 140",
  "hyundai hx 140 w",
];

/** Free-text searches on the classifieds / Machineryline: spelling variants people really use. */
const TEXT_QUERIES = [
  "yanmar vio 55",
  "yanmar sv 55",
  "doosan dx 55",
  "doosan dx55",
  "doosan dx 55 w",
  "doosan dx 140",
  "doosan dx140",
  "doosan dx 140 lc",
  "hyundai r 55",
  "hyundai r55",
  "hyundai robex 55",
  "hyundai r 140",
  "hyundai r140",
  "hyundai robex 140",
  "hyundai hx 140",
  // wheeled excavators (Mobilbagger / Radbagger)
  "mobilbagger doosan dx 55",
  "mobilbagger doosan dx 140",
  "mobilbagger hyundai 55",
  "mobilbagger hyundai 140",
  "mobilbagger yanmar 55",
  "doosan dx 55 w",
  "doosan dx 140 w",
  "hyundai r 55 w",
  "hyundai r 140 w",
  "hyundai robex 140 w",
  "radbagger doosan",
  "radbagger hyundai",
];

const TS24 = "https://www.truckscout24.de/baumaschinen/gebraucht";

export const SOURCES: Source[] = [
  {
    id: "maschinensucher",
    name: "Maschinensucher",
    enabled: true,
    urls: () => MASCHINENSUCHER_QUERIES.map((q) => `https://www.maschinensucher.de/mss/${plus(q)}`),
  },
  {
    // Category pages per make (verified URL pattern) with ?page=N pagination.
    // DX55 / R55 / ViO55 are mini excavators, DX140 / R140 are crawlers, and the "W" variants are wheeled.
    id: "truckscout24",
    name: "TruckScout24",
    enabled: true,
    urls: () => [
      // wheeled excavators first: that is the main focus
      ...range(6).map((n) => `${TS24}/mobilbagger/doosan?page=${n}`),
      ...range(4).map((n) => `${TS24}/mobilbagger/hyundai?page=${n}`),
      ...range(3).map((n) => `${TS24}/mobilbagger/yanmar?page=${n}`),
      ...range(2).map((n) => `${TS24}/minibagger/yanmar?page=${n}`),
      ...range(4).map((n) => `${TS24}/minibagger/doosan?page=${n}`),
      ...range(4).map((n) => `${TS24}/kettenbagger/doosan?page=${n}`),
      ...range(3).map((n) => `${TS24}/minibagger/hyundai?page=${n}`),
      ...range(3).map((n) => `${TS24}/kettenbagger/hyundai?page=${n}`),
    ],
  },
  {
    id: "kleinanzeigen",
    name: "Kleinanzeigen",
    enabled: true,
    urls: () => [
      ...TEXT_QUERIES.map((q) => `https://www.kleinanzeigen.de/s-${dash(q)}/k0`),
      // second page for the broadest searches
      ...["doosan dx 55", "doosan dx 140", "hyundai r 55", "hyundai r 140"].map(
        (q) => `https://www.kleinanzeigen.de/s-seite:2/${dash(q)}/k0`,
      ),
    ],
  },
  {
    // Added at the owner's request. NOTE: the site's robots.txt asks bots not to read search_text.php,
    // so it may block us (empty pages / errors show up in the per-source result in the app header).
    id: "machineryline",
    name: "Machineryline",
    enabled: true,
    urls: () =>
      ["Yanmar 55", "Doosan 55", "Doosan DX55", "Doosan DX55W", "Doosan 140", "Doosan DX140", "Doosan DX140W", "Hyundai 55", "Hyundai R55", "Hyundai R55W", "Hyundai 140", "Hyundai R140", "Hyundai R140W", "Robex 55", "Robex 140", "Mobilbagger Doosan", "Mobilbagger Hyundai"].map(
        (q) => `https://machineryline.de/search_text.php?query=${plus(q)}`,
      ),
  },
  {
    // Not verified yet — enable and check the per-source result in the app header.
    id: "mascus",
    name: "Mascus",
    enabled: false,
    urls: () => TEXT_QUERIES.map((q) => `https://www.mascus.de/search?q=${plus(q)}`),
  },
];
