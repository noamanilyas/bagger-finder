/**
 * What we look for and where we look. Edit this file to add models or sources.
 */

export type WantedModel = {
  key: string;
  label: string;
  /** all of these must match the listing text (title + make + model) */
  make: RegExp;
  number: RegExp;
  /** weak model patterns (plain "55", "R 140") also need the word Bagger/excavator in the text */
  needsBagger?: boolean;
};

export const WANTED: WantedModel[] = [
  // "55" must stand alone: not part of 225/55 R18, 300x55,5x82 or 1.755.
  // Covers ViO55, SV55 and the wheeled B55W ("B 55W-2", "B-55W").
  { key: "yanmar-55", label: "Yanmar 55", make: /yanmar/i, number: /(?<![\d/x,.])(?:vio|sv)?\s*-?\s*55(?!\d|[,.]\d)/i, needsBagger: true },
  { key: "doosan-dx55", label: "Doosan DX55", make: /do{1,2}san|develon|daewoo/i, number: /dx\s*-?\s*55(?!\d)/i },
  { key: "doosan-dx140", label: "Doosan DX140", make: /do{1,2}san|develon|daewoo/i, number: /dx\s*-?\s*140(?!\d)/i },
  { key: "hyundai-140", label: "Hyundai 140", make: /hyundai/i, number: /(?:robex|hx|hw|w|(?<![a-z])r)\s*-?\s*140(?!\d)|(?<!\d)140\s*-?\s*w(?![a-z])/i, needsBagger: true },
  { key: "hyundai-55", label: "Hyundai 55", make: /hyundai/i, number: /(?:robex|hx|(?<![a-z])r)\s*-?\s*55(?!\d)|(?<![\d/x,.])55\s*-?\s*w(?![a-z])/i, needsBagger: true },
  // the machine types the owner pointed at: Minibagger DX60, Mobilbagger DX210
  { key: "doosan-dx60", label: "Doosan DX60", make: /do{1,2}san|develon|daewoo/i, number: /dx\s*-?\s*60(?!\d)/i },
  { key: "doosan-dx210", label: "Doosan DX210", make: /do{1,2}san|develon|daewoo/i, number: /dx\s*-?\s*210(?!\d)/i },
];

/** Never an excavator for sale: tyres, rubber tracks, parts, rentals, wanted ads. */
const HARD_EXCLUDE =
  /reifen|räder\b|felge|gummiketten?|gummipads?|laufrolle|ersatzteil|zahnrad|kühler|hydraulikpumpe|anhänger|vermiet|mieten|miete\b|mietpreis|tagesmiete|mietmaschine|\/\s*tag\b|pro tag|zu miete|mietbagger|gesuch|suche\s|radlader|gabelstapler|stapler|generator|cnc|bearbeitungszentrum|drehmaschine|fräsmaschine|dreh- und fräs|landmaschine/i;
/** Parts that name an engine/cab: only excluded when the text does not call the thing an excavator. */
const SOFT_EXCLUDE = /motor\b|motoren|kabine|schlüssel|scheibe/i;

/** Sizes the owner does not want (Hyundai/Doosan 150 and 170 class), even when the text also names a wanted one. */
const UNWANTED_SIZE = /(?:robex|hx|hw|dx|w|(?<![a-z])r)\s*-?\s*(?:150|170)(?!\d)|(?<!\d)(?:150|170)\s*-?\s*w(?![a-z])/i;

/** Ads that open by naming a part or attachment. Only the start counts: real machines often list "mit Schnellwechsler". */
const PART_AD = /^\W*(?:hydraulisch\w*\s+)?(?:fahrantrieb|endantrieb|fahrmotor|schwenkmotor|schnellwechsler|(?:tief|grab\w*|sieb)?löffel|planierschild|bolzen|zylinder|lanturi)/i;

export function matchModel(text: string): WantedModel | null {
  if (PART_AD.test(text)) return null;
  if (HARD_EXCLUDE.test(text)) return null;
  if (UNWANTED_SIZE.test(text)) return null;
  if (SOFT_EXCLUDE.test(text) && !/bagger|excavator/i.test(text)) return null;
  for (const m of WANTED) {
    if (m.make.test(text) && m.number.test(text) && (!m.needsBagger || /bagger|excavator/i.test(text))) return m;
  }
  return null;
}

/**
 * Wheeled excavator (Mobilbagger): by the word or by a "W" model suffix (DX55W, R140W-9, Robex 55W).
 * Decided from the machine's own text only: wheeled search pages also list mini and crawler excavators.
 */
export function isWheeled(text: string): boolean {
  return /mobilbagger|radbagger|mobile excavator|wheel(?:ed)? excavator|(?:dx|robex|hx|r|b|sv)\s*-?\s*\d{2,3}\s*-?\s*w(?![a-z])/i.test(text);
}

/** The search is Europe-wide (owner's request). Names as they appear on German-language marketplaces. */
export const EUROPE =
  /deutschland|germany|polen|poland|frankreich|france|niederlande|netherlands|belgien|luxemburg|österreich|schweiz|italien|spanien|portugal|tschechi|slowakei|ungarn|rumänien|bulgarien|slowenien|kroatien|serbien|bosnien|albanien|mazedonien|montenegro|kosovo|griechenland|litauen|lithuania|lettland|estland|finnland|schweden|norwegen|dänemark|großbritannien|vereinigtes königreich|irland|island|malta|zypern|ukraine|moldau/i;

/** Listings located here are skipped: outside Europe, plus Turkey, Russia and Belarus. */
export const NON_EUROPE =
  /china|indien|emirate|\busa\b|vereinigte staaten|kanada|japan|korea|türkei|russland|belarus|weißrussland|kasachstan|usbekistan|georgien|armenien|aserbaidschan|israel|saudi|katar|iran|irak|ägypten|marokko|südafrika|brasilien|australien/i;

/** Catches countries missing from the lists above, once a listing has coordinates. */
export const inEurope = (c: { lat: number; lng: number }) => c.lat >= 34 && c.lat <= 72 && c.lng >= -25 && c.lng <= 45;

/** Cheap pre-filter so we only send plausible blocks to the AI. */
export function looksRelevant(text: string): boolean {
  return /yanmar|do{1,2}san|develon|daewoo|hyundai/i.test(text) || /\bdx\s*-?\s*\d{2,3}/i.test(text);
}

/** null means no limit. */
export type Limits = { maxPrice: number | null; maxYear: number | null };

/** What the scraper keeps by default, and what the app's filters start at. */
export const DEFAULT_LIMITS: Limits = { maxPrice: 45_000, maxYear: 2015 };

/** Limits sent by the app: a positive whole number or null (no limit); anything else falls back to the default. */
export function parseLimits(input: unknown): Limits {
  const body = (input ?? {}) as Record<string, unknown>;
  const read = (v: unknown, fallback: number | null) =>
    v === null ? null : typeof v === "number" && Number.isInteger(v) && v > 0 ? v : fallback;
  return {
    maxPrice: read(body.maxPrice, DEFAULT_LIMITS.maxPrice),
    maxYear: read(body.maxYear, DEFAULT_LIMITS.maxYear),
  };
}

/** Limits for this scraper run: set by "Refresh now" through the environment (empty = no limit), else the defaults. */
export function scrapeLimits(): Limits {
  const read = (v: string | undefined, fallback: number | null) => (v === undefined ? fallback : Number(v) || null);
  return {
    maxPrice: read(process.env.SCRAPE_MAX_PRICE, DEFAULT_LIMITS.maxPrice),
    maxYear: read(process.env.SCRAPE_MAX_YEAR, DEFAULT_LIMITS.maxYear),
  };
}

/** An unknown price or year is kept: many good ads say "Preis auf Anfrage" or leave the year out. */
export function withinLimits(item: { priceEur: number | null; year: number | null }, limits: Limits): boolean {
  if (limits.maxPrice != null && item.priceEur != null && item.priceEur > limits.maxPrice) return false;
  if (limits.maxYear != null && item.year != null && item.year > limits.maxYear) return false;
  return true;
}

/**
 * Machineryline's own filter per category: Doosan (3881), Hyundai (2611), Yanmar (3015), built up to the max year.
 * The price stays out of the URL on purpose: the site's price filter hides "Preis auf Anfrage" ads; run.ts applies it instead.
 * Page counts fit the default year limit; a later year (or none) has more results, so read further.
 */
function machinerylinePages(mobileOnly: boolean): string[] {
  const { maxYear } = scrapeLimits();
  const scale = maxYear === DEFAULT_LIMITS.maxYear ? 1 : 3;
  const year = maxYear != null ? `ym=%3A${maxYear}&` : "";
  const categories: [string, string, number][] = [
    ["Mobilbagger", "c164", 4],
    ["Minibagger", "c166", 8],
    ["Midibagger", "c5601", 2],
    ["Kettenbagger", "c167", 15],
  ];
  return categories.filter(([name]) => !mobileOnly || name === "Mobilbagger").flatMap(([name, id, pages]) =>
    range(pages * scale).map((n) => `https://machineryline.de/-/${name}--${id}?${year}mark_id=3881%3B2611%3B3015&page=${n}`),
  );
}

export type Source = {
  id: string;
  name: string;
  enabled: boolean;
  /** search/listing page URLs to crawl for this source */
  urls: (mobileOnly: boolean) => string[];
  /** when set, only links passing this test can become listings (drops filter links, rentals and so on) */
  isListing?: (url: string) => boolean;
};

const plus = (q: string) => q.trim().replace(/\s+/g, "+");
const dash = (q: string) => q.trim().toLowerCase().replace(/\s+/g, "-");
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/**
 * Maschinensucher searches by model name ("make model [suffix]"), so besides the plain model we also
 * try the common suffixes (LC/LCR crawler, W wheeled, R) that have their own result pages.
 */
const MASCHINENSUCHER_QUERIES = [
  "yanmar b 55",
  "yanmar b 55 w",
  "yanmar b55w",
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
  "yanmar b 55",
  "yanmar b55w",
  "yanmar b 55 w",
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

/** Searches aimed at wheeled machines: they name the type or end in the "W" of the model. */
const isMobileQuery = (q: string) => /mobilbagger|radbagger|(?:\s|\d)w$/.test(q);
const queriesFor = (queries: string[], mobileOnly: boolean) => (mobileOnly ? queries.filter(isMobileQuery) : queries);

const TS24 = "https://www.truckscout24.de/baumaschinen/gebraucht";
export const SOURCES: Source[] = [
  {
    id: "maschinensucher",
    name: "Maschinensucher",
    enabled: true,
    isListing: (url) => /\/i-\d+(?:\?|$)/.test(url),
    urls: (mobileOnly) => queriesFor(MASCHINENSUCHER_QUERIES, mobileOnly).map((q) => `https://www.maschinensucher.de/mss/${plus(q)}`),
  },
  {
    // Category pages per make (verified URL pattern) with ?page=N pagination.
    // DX55 / R55 / ViO55 are mini excavators, DX140 / R140 are crawlers, and the "W" variants are wheeled.
    id: "truckscout24",
    name: "TruckScout24",
    enabled: true,
    isListing: (url) => /\/tsp\/ts-[\d-]+(?:\?|$)/.test(url),
    urls: (mobileOnly) => [
      // wheeled excavators first: that is the main focus
      ...range(6).map((n) => `${TS24}/mobilbagger/doosan?page=${n}`),
      ...range(4).map((n) => `${TS24}/mobilbagger/hyundai?page=${n}`),
      ...range(3).map((n) => `${TS24}/mobilbagger/yanmar?page=${n}`),
      ...(mobileOnly
        ? []
        : [
            ...range(2).map((n) => `${TS24}/minibagger/yanmar?page=${n}`),
            ...range(4).map((n) => `${TS24}/minibagger/doosan?page=${n}`),
            ...range(4).map((n) => `${TS24}/kettenbagger/doosan?page=${n}`),
            ...range(3).map((n) => `${TS24}/minibagger/hyundai?page=${n}`),
            ...range(3).map((n) => `${TS24}/kettenbagger/hyundai?page=${n}`),
          ]),
    ],
  },
  {
    id: "kleinanzeigen",
    name: "Kleinanzeigen",
    enabled: true,
    // real ads only: not search links, seller profiles or the login page behind "save this search"
    isListing: (url) => /\/s-anzeige\/.+\/\d+-\d+-\d+(?:\?|$)/.test(url),
    urls: (mobileOnly) => [
      ...queriesFor(TEXT_QUERIES, mobileOnly).map((q) => `https://www.kleinanzeigen.de/s-${dash(q)}/k0`),
      // second page for the broadest searches
      ...(mobileOnly ? [] : ["doosan dx 55", "doosan dx 140", "hyundai r 55", "hyundai r 140"]).map(
        (q) => `https://www.kleinanzeigen.de/s-seite:2/${dash(q)}/k0`,
      ),
    ],
  },
  {
    // Added at the owner's request. Category pages only: robots.txt allows them, unlike search_text.php.
    id: "machineryline",
    name: "Machineryline",
    enabled: true,
    isListing: (url) => /\/-\/Verkauf\/(?:Mobilbagger|Minibagger|Midibagger|Kettenbagger|Bagger)\/.+--\d{10,}$/.test(url),
    urls: machinerylinePages,
  },
  {
    // Not verified yet — enable and check the per-source result in the app header.
    id: "mascus",
    name: "Mascus",
    enabled: false,
    urls: (mobileOnly) => queriesFor(TEXT_QUERIES, mobileOnly).map((q) => `https://www.mascus.de/search?q=${plus(q)}`),
  },
];
