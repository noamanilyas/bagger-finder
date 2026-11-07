/**
 * What we look for and where we look. Edit this file to add models or sources.
 * Words in other languages live in lib/languages, country names in lib/countries.ts.
 */
import { withinBudget } from "./costs";
import { DEFAULT_LANGUAGES, EXCAVATOR_WORD, TRACKED_WORD, WHEELED_WORD, exclusionsFor, type LangCode } from "./languages";

export type WantedModel = {
  key: string;
  label: string;
  /** all of these must match the listing text (title + make + model) */
  make: RegExp;
  number: RegExp;
  /** weak model patterns (plain "55", "R 140") also need a word for excavator in the text, in any language */
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

/** Sizes the owner does not want (Hyundai/Doosan 150 and 170 class), even when the text also names a wanted one. */
const UNWANTED_SIZE = /(?:robex|hx|hw|dx|w|(?<![a-z])r)\s*-?\s*(?:150|170)(?!\d)|(?<!\d)(?:150|170)\s*-?\s*w(?![a-z])/i;

/** The model an ad is for, or why it was turned down. */
export type Decision = { model: WantedModel; reason: null } | { model: null; reason: string };

const no = (reason: string): Decision => ({ model: null, reason });

/**
 * Decides on one ad. `languages` are those of the site it came from: they choose the exclusions.
 * Word lists are in lib/languages; the order of the checks below matters and is covered by tests/languages.test.ts.
 */
export function classify(text: string, languages: LangCode[] = DEFAULT_LANGUAGES): Decision {
  const words = exclusionsFor(languages);
  const part = text.match(words.partAtStart);
  if (part) return no(`opens with a part: "${part[0].trim()}"`);
  const notForSale = text.match(words.notForSale);
  if (notForSale) return no(`not for sale: "${notForSale[0]}"`);
  if (UNWANTED_SIZE.test(text)) return no("unwanted size (150 or 170 class)");
  const isExcavator = EXCAVATOR_WORD.test(text) || words.weakExcavator.test(text);
  const soft = text.match(words.softExclude);
  if (soft && !isExcavator) return no(`a part, not called an excavator: "${soft[0]}"`);
  let weak: WantedModel | null = null;
  for (const m of WANTED) {
    if (!m.make.test(text) || !m.number.test(text)) continue;
    if (!m.needsBagger || isExcavator) return { model: m, reason: null };
    weak ??= m;
  }
  return no(weak ? `${weak.label} needs a word for excavator` : "no wanted make and model");
}

export function matchModel(text: string, languages: LangCode[] = DEFAULT_LANGUAGES): WantedModel | null {
  return classify(text, languages).model;
}

/** The "W" that marks a wheeled model (DX55W, R140W-9, Robex 55W), or Hyundai's HW range. Nothing to translate here. */
const WHEELED_MODEL = /(?:dx|robex|hx|r|b|sv)\s*-?\s*\d{2,3}\s*-?\s*w(?![a-z])|(?<![a-z])hw\s*-?\s*\d{2,3}(?!\d)/i;

/** LC and NLC mark crawlers: R140LC-9, DX140LCR. */
const TRACKED_MODEL = /(?:dx|robex|hx|r)\s*-?\s*\d{2,3}\s*-?\s*n?lc/i;

/**
 * Wheeled excavator (Mobilbagger): by the word, in any language, or by the model name.
 * Decided from the machine's own text only: wheeled search pages also list mini and crawler excavators.
 * `title`, when given, has the last word: sellers file crawlers under "Mobilbagger", and that label is on the card.
 */
export function isWheeled(text: string, title?: string | null): boolean {
  const says = (t: string) => WHEELED_WORD.test(t) || WHEELED_MODEL.test(t);
  if (title && !says(title) && (TRACKED_WORD.test(title) || TRACKED_MODEL.test(title))) return false;
  return says(text);
}

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

/**
 * An unknown price or year is kept: many good ads say "Preis auf Anfrage" or leave the year out.
 * The max price is a budget for what gets paid, so an asking price that negotiation could bring within it is kept too.
 */
export function withinLimits(item: { priceEur: number | null; year: number | null }, limits: Limits): boolean {
  if (limits.maxPrice != null && item.priceEur != null && !withinBudget(item.priceEur, limits.maxPrice)) return false;
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
  /** what the ads are written in: chooses the exclusions and field labels (see lib/languages) */
  languages: LangCode[];
  /** added to a place that names no country when finding it on the map; null when ads come from all over */
  defaultCountry: string | null;
  /** places end in an ISO country code ("Siegen, DE"), which is only safe to read on sites known to do this */
  countryCodes?: boolean;
  /** keep a space between a card's elements, which whole-word matching needs. Use this on every new source. */
  spacedText?: boolean;
  /** plain HTTP cannot read this site, so go straight to the browser */
  browser?: boolean;
  /** false: never send this site's text to AI models, for example when its robots.txt says ai-train=no */
  ai?: boolean;
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
    languages: ["de"],
    defaultCountry: "Deutschland",
    isListing: (url) => /\/i-\d+(?:\?|$)/.test(url),
    urls: (mobileOnly) => queriesFor(MASCHINENSUCHER_QUERIES, mobileOnly).map((q) => `https://www.maschinensucher.de/mss/${plus(q)}`),
  },
  {
    // Category pages per make (verified URL pattern) with ?page=N pagination.
    // DX55 / R55 / ViO55 are mini excavators, DX140 / R140 are crawlers, and the "W" variants are wheeled.
    id: "truckscout24",
    name: "TruckScout24",
    enabled: true,
    languages: ["de"],
    defaultCountry: "Deutschland",
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
    languages: ["de"],
    defaultCountry: "Deutschland",
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
    languages: ["de"],
    defaultCountry: "Deutschland",
    isListing: (url) => /\/-\/Verkauf\/(?:Mobilbagger|Minibagger|Midibagger|Kettenbagger|Bagger)\/.+--\d{10,}$/.test(url),
    urls: machinerylinePages,
  },
  {
    // The largest portal. Category pages per make; the German site lists machines from all countries, in EUR.
    id: "mascus",
    name: "Mascus",
    enabled: true,
    languages: ["de", "en"],
    defaultCountry: null,
    countryCodes: true,
    spacedText: true,
    isListing: (url) => /mascus\.de\/baumaschinen\/[a-z-]+\/[^/]+\/[a-z0-9]{6,}\.html(?:\?|$)/.test(url),
    // 40 ads per page. Pages per make fit the counts on 2026-11-07 (219, 191, 40, 67), plus one to allow for growth.
    urls: () =>
      Object.entries({ hyundai: 7, doosan: 6, develon: 2, yanmar: 3 }).flatMap(([make, pages]) =>
        range(pages).map((n) => `https://www.mascus.de/baumaschinen/mobilbagger/${make}${n > 1 ? `?page=${n}` : ""}`),
      ),
  },
  {
    // robots.txt allows crawling but says ai-train=no, and free AI models may train on what they are sent: regex parser only.
    id: "europe-construction-equipment",
    name: "Europe-Construction-Equipment",
    enabled: true,
    languages: ["en"],
    defaultCountry: null,
    spacedText: true,
    ai: false,
    isListing: (url) => /europe-construction-equipment\.com\/.+\/ts-vi\d+\/used\.html(?:\?|$)/.test(url),
    // About 20 ads per page. Pages per make fit the counts on 2026-11-07 (49, 47, 7, 14), plus room for growth.
    urls: () =>
      Object.entries({
        "hyundai-wheel-excavator/~a2b1c3e355": 4,
        "doosan-wheel-excavator/~a2b1c3e803": 4,
        "develon-wheel-excavator/~a2b1c3e7872": 1,
        "yanmar-wheel-excavator/~a2b1c3e788": 2,
      }).flatMap(([path, pages]) =>
        range(pages).map((n) => `https://www.europe-construction-equipment.com/${path}/used.html${n > 1 ? `?p=${n}` : ""}`),
      ),
  },
  {
    // Serves only a JavaScript cookie page to plain HTTP, so it goes straight to the browser.
    id: "truck1",
    name: "Truck1",
    enabled: true,
    languages: ["en"],
    defaultCountry: null,
    browser: true,
    isListing: (url) => /truck1\.eu\/construction-machinery\/wheel-excavators\/.+-a\d{5,}\.html(?:\?|$)/.test(url),
    // Up to 31 ads per page; robots.txt allows ?page=. Pages per make fit the counts on 2026-11-07 (112, 83, 7, 4), plus one.
    urls: () =>
      Object.entries({ hyundai: 5, doosan: 4, develon: 1, yanmar: 1 }).flatMap(([make, pages]) =>
        range(pages).map((n) => `https://www.truck1.eu/construction-machinery/wheel-excavators/${make}${n > 1 ? `?page=${n}` : ""}`),
      ),
  },
];
