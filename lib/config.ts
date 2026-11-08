/**
 * What we look for and where we look. Edit this file to add models or sources.
 * Words in other languages live in lib/languages, country names in lib/countries.ts.
 */
import { withinBudget } from "./costs";
import type { Currency } from "./currency";
import { DEFAULT_LANGUAGES, EXCAVATOR_WORD, GRADER_WORD, LOADER_WORD, ROLLER_WORD, TRACKED_WORD, WHEELED_WORD, exclusionsFor, type LangCode } from "./languages";

export type WantedModel = {
  key: string;
  label: string;
  /** all of these must match the listing text (title + make + model) */
  make: RegExp;
  number: RegExp;
  /** weak model patterns (plain "55", "R 140") also need a word for excavator in the text, in any language */
  needsBagger?: boolean;
  /** the same for other machines: a plain "140" only counts next to a word for grader */
  needsWord?: RegExp;
  /** a spelling that is enough without any such word: "140H" */
  strong?: RegExp;
  /** a wheel loader, which the wheel loader exclusion must leave alone */
  loader?: boolean;
  /** not only wheeled: the "only scrape Mobilbagger" setting does not apply to it (crawlers on the list, graders, loaders, rollers) */
  anyType?: boolean;
  /** this model only within these limits, on top of the general ones. An unknown price or year is kept, as with those. */
  maxPriceEur?: number;
  minYear?: number;
  maxYear?: number;
};

const DOOSAN = /do{1,2}san|develon|daewoo/i;
const SOLAR = /do{1,2}san|develon|daewoo|solar/i;
const CAT = /caterpillar|(?<![a-z])cat(?![a-z])/i;
const HITACHI = /hitachi/i;
const JCB = /jcb/i;
const SAMSUNG = /samsung|sumsung/i;
const DYNAPAC = /dyna?p[ae]c/i;

/** "Doosan 140-WV" and "Daewoo 225 LC" name the size without DX or Solar. Only with W or LC behind it: "Doosan 140 PS" is no model. */
const makeAndSize = (n: number) => String.raw`(?:do{1,2}san|develon|daewoo)\s*-?\s*${n}\s*-?\s*(?:w|n?lc)`;
const dx = (n: number) => new RegExp(String.raw`dx\s*-?\s*${n}(?!\d)|${makeAndSize(n)}`, "i");
/** Solar is the old name of the Doosan and Daewoo range, also written S130W. */
const solar = (n: number) => new RegExp(String.raw`(?:solar|(?<![a-z])s)\s*-?\s*${n}(?!\d)|${makeAndSize(n)}`, "i");
/** "EX 60", "EX100-3", but not the end of "Flex 60". */
const ex = (n: number, after = "") => new RegExp(String.raw`(?<![a-z])ex\s*-?\s*${n}(?!\d)${after}`, "i");
const js = (n: number) => new RegExp(String.raw`(?<![a-z])js\s*-?\s*${n}(?!\d)`, "i");
/**
 * Cat's second series: the owner asks for the 966G2, but sellers write 966G almost every time and hardly ever 966G II
 * (Machineryline, 2026-11-07), so the plain name counts too. Which series it is shows on the machine, not in the ad.
 */
const series2 = (n: number, letter: string) =>
  new RegExp(String.raw`(?<!\d)${n}\s*-?\s*${letter}(?:\s*-?\s*(?:serie[s]?\s*)?(?:2|ii))?(?![a-z\d])`, "i");
/** Capitals only, because "980 h" and "140 h" are operating hours. */
const catSuffix = (n: number, letters: string) => new RegExp(String.raw`(?<![\d.,/])${n}[\s-]?[${letters}](?![A-Za-z\d])`);
/** A plain number, next to a word for grader. Not a power, a distance or hours. */
const plain = (n: number) =>
  new RegExp(String.raw`(?<![\d/x,.])${n}(?!\d|[,.]\d|\s*(?:ps|hp|kw|km|mm|cm|kg|t|h|std)(?![a-z]))`, "i");

const grader = (n: number): WantedModel => ({
  key: `cat-${n}`,
  label: `Cat ${n} grader`,
  make: CAT,
  number: plain(n),
  needsWord: GRADER_WORD,
  strong: catSuffix(n, "GHKM"),
  anyType: true,
});

const loader = (key: string, label: string, strong: RegExp): WantedModel => ({
  key,
  label,
  make: CAT,
  number: strong,
  loader: true,
  anyType: true,
});

export const WANTED: WantedModel[] = [
  // "55" must stand alone: not part of 225/55 R18, 300x55,5x82 or 1.755.
  // Covers ViO55, SV55 and the wheeled B55W ("B 55W-2", "B-55W").
  { key: "yanmar-55", label: "Yanmar 55", make: /yanmar/i, number: /(?<![\d/x,.])(?:vio|sv)?\s*-?\s*55(?!\d|[,.]\d)/i, needsBagger: true },
  { key: "doosan-dx55", label: "Doosan DX55", make: DOOSAN, number: dx(55) },
  { key: "doosan-dx140", label: "Doosan DX140", make: DOOSAN, number: dx(140) },
  { key: "hyundai-140", label: "Hyundai 140", make: /hyundai/i, number: /(?:robex|hx|hw|w|(?<![a-z])r)\s*-?\s*140(?!\d)|(?<!\d)140\s*-?\s*w(?![a-z])/i, needsBagger: true },
  { key: "hyundai-55", label: "Hyundai 55", make: /hyundai/i, number: /(?:robex|hx|(?<![a-z])r)\s*-?\s*55(?!\d)|(?<![\d/x,.])55\s*-?\s*w(?![a-z])/i, needsBagger: true },
  // the machine types the owner pointed at: Minibagger DX60, Mobilbagger DX210
  { key: "doosan-dx60", label: "Doosan DX60", make: DOOSAN, number: dx(60) },
  { key: "doosan-dx210", label: "Doosan DX210", make: DOOSAN, number: dx(210) },
  // the owner also wants these wheeled sizes
  { key: "doosan-dx160", label: "Doosan DX160", make: DOOSAN, number: dx(160) },
  { key: "doosan-dx190", label: "Doosan DX190", make: DOOSAN, number: dx(190) },

  // The owner's model list of 2026-11-07. Each size has its own key, because prices are compared per key.
  { key: "doosan-dx57", label: "Doosan DX57", make: DOOSAN, number: dx(57) },
  { key: "doosan-dx170", label: "Doosan DX170", make: DOOSAN, number: dx(170) },
  { key: "doosan-dx225", label: "Doosan DX225", make: DOOSAN, number: dx(225), anyType: true },
  { key: "doosan-dx300", label: "Doosan DX300", make: DOOSAN, number: dx(300), anyType: true },
  { key: "doosan-dh130", label: "Doosan DH130", make: DOOSAN, number: /dh\s*-?\s*130(?!\d)/i },
  { key: "solar-55", label: "Solar 55", make: SOLAR, number: solar(55) },
  { key: "solar-80", label: "Solar 80", make: SOLAR, number: solar(80) },
  { key: "solar-130", label: "Solar 130", make: SOLAR, number: solar(130), anyType: true }, // both 130W and 130LC are on the list
  { key: "solar-140", label: "Solar 140", make: SOLAR, number: solar(140) },
  { key: "solar-170", label: "Solar 170", make: SOLAR, number: solar(170) },
  { key: "solar-225", label: "Solar 225", make: SOLAR, number: solar(225), anyType: true },
  { key: "solar-300", label: "Solar 300", make: SOLAR, number: solar(300), anyType: true },
  { key: "hyundai-130", label: "Hyundai 130W", make: /hyundai/i, number: /(?:robex|hx|(?<![a-z])r)\s*-?\s*130\s*-?\s*w(?![a-z])|(?<![a-z])hw\s*-?\s*130(?!\d)|(?<!\d)130\s*-?\s*w(?![a-z])/i, needsBagger: true },
  { key: "volvo-ew170", label: "Volvo EW170", make: /volvo/i, number: /(?<![a-z])ew\s*-?\s*170(?!\d)/i },
  { key: "hitachi-ex60", label: "Hitachi EX60", make: HITACHI, number: ex(60), anyType: true }, // wheeled and chain
  { key: "hitachi-ex100", label: "Hitachi EX100", make: HITACHI, number: ex(100), anyType: true },
  { key: "hitachi-ex120", label: "Hitachi EX120", make: HITACHI, number: ex(120), anyType: true },
  { key: "hitachi-ex160", label: "Hitachi EX160WD", make: HITACHI, number: ex(160, String.raw`\s*-?\s*w`) },
  { key: "jcb-js140", label: "JCB JS140", make: JCB, number: js(140), anyType: true, maxPriceEur: 20_000 },
  { key: "jcb-js145", label: "JCB JS145", make: JCB, number: js(145), anyType: true, maxPriceEur: 20_000 },
  { key: "samsung-mx6", label: "Samsung MX6W", make: SAMSUNG, number: /(?<![a-z])mx\s*-?\s*6\s*-?\s*w/i, minYear: 1990, maxYear: 2000 },
  { key: "samsung-mx132", label: "Samsung MX132W", make: SAMSUNG, number: /(?<![a-z])mx\s*-?\s*132\s*-?\s*w/i, minYear: 1990, maxYear: 2000 },
  // Needs the word: a "Samsung 130W" is also a phone charger.
  { key: "samsung-130", label: "Samsung 130W", make: SAMSUNG, number: /(?<!\d)130\s*-?\s*w(?![a-z])/i, needsBagger: true, minYear: 1990, maxYear: 2000 },
  grader(120),
  grader(130),
  grader(140),
  loader("cat-966f2", "Cat 966F / F II", series2(966, "f")),
  loader("cat-966g2", "Cat 966G / G II", series2(966, "g")),
  loader("cat-970f", "Cat 970F", /(?<!\d)970\s*-?\s*f(?![a-z\d])/i),
  loader("cat-972g2", "Cat 972G / G II", series2(972, "g")),
  loader("cat-972h", "Cat 972H", catSuffix(972, "H")),
  loader("cat-980g2", "Cat 980G / G II", series2(980, "g")),
  loader("cat-980h", "Cat 980H", catSuffix(980, "H")),
  { key: "dynapac-ca2510", label: "Dynapac CA2510", make: DYNAPAC, number: /(?<![a-z])ca\s*-?\s*2510(?!\d)/i, anyType: true },
  // any Dynapac roller: by the word, or by its model series (CA soil compactors, CC and CG tandem rollers)
  { key: "dynapac-roller", label: "Dynapac roller", make: DYNAPAC, number: /(?:)/, needsWord: ROLLER_WORD, strong: /(?<![a-z])c[acg]\s*-?\s*\d{2,4}/i, anyType: true },
];

/**
 * Sizes the owner does not want (the Hyundai 150 and 170 class, and the DX150), even when the text also names a wanted one.
 * The Doosan and Solar 170 and the Volvo EW170 are wanted, so a bare "170W" behind one of those does not count.
 */
const UNWANTED_SIZE =
  /(?:robex|hx|hw|(?<![a-z])w|(?<![a-z])r)\s*-?\s*(?:150|170)(?!\d)|dx\s*-?\s*150(?!\d)|(?<!\d)150\s*-?\s*w(?![a-z])|(?<!(?:dx|solar|do{1,2}san|develon|daewoo|(?<![a-z])s)\s*-?\s*)(?<!\d)170\s*-?\s*w(?![a-z])/i;

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
  // "Motor Grader" is a machine, so any word that names a machine lifts this exclusion.
  if (soft && !isExcavator && !GRADER_WORD.test(text) && !LOADER_WORD.test(text) && !ROLLER_WORD.test(text)) {
    return no(`a part, not called a machine: "${soft[0]}"`);
  }
  const loaderWord = text.match(words.loader);
  let skippedForLoader = false;
  let weak: WantedModel | null = null;
  for (const m of WANTED) {
    if (!m.make.test(text)) continue;
    const strong = m.strong?.test(text) ?? false;
    if (!strong && !m.number.test(text)) continue;
    if (loaderWord && !m.loader) {
      skippedForLoader = true;
      continue;
    }
    if (strong || (m.needsWord ? m.needsWord.test(text) : !m.needsBagger || isExcavator)) return { model: m, reason: null };
    weak ??= m;
  }
  if (skippedForLoader) return no(`not for sale: "${loaderWord![0]}"`);
  return no(weak ? `${weak.label} needs a word for what it is` : "no wanted make and model");
}

export function matchModel(text: string, languages: LangCode[] = DEFAULT_LANGUAGES): WantedModel | null {
  return classify(text, languages).model;
}

/** The "W" that marks a wheeled model (DX55W, R140W-9, Robex 55W), or Hyundai's HW range. Nothing to translate here. */
const WHEELED_MODEL =
  /(?:dx|robex|hx|r|b|sv|(?<![a-z])(?:solar|s|dh|se|do{1,2}san|daewoo|develon|samsung))\s*-?\s*\d{2,3}\s*-?\s*w[vr]?(?![a-z])|(?<![a-z])mx\s*-?\s*\d{1,3}\s*-?\s*w(?![a-z])|(?<![a-z])ex\s*-?\s*\d{2,3}\s*-?\s*wd?(?![a-z])|(?<![a-z])hw\s*-?\s*\d{2,3}(?!\d)|(?<![a-z])ewr?\s*-?\s*\d{2,3}(?!\d)/i;

/** LC and NLC mark crawlers: R140LC-9, DX140LCR. */
const TRACKED_MODEL = /(?:dx|robex|hx|r|(?<![a-z])(?:solar|s))\s*-?\s*\d{2,3}\s*-?\s*n?lc/i;

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

/** The "only scrape Mobilbagger" setting keeps wheeled machines, and models on the list that are not only wheeled. */
export function fitsMobileOnly(model: WantedModel, text: string, title?: string | null): boolean {
  return model.anyType === true || isWheeled(text, title);
}

/** Cheap pre-filter so we only send plausible blocks to the AI. */
export function looksRelevant(text: string): boolean {
  return /yanmar|do{1,2}san|develon|daewoo|hyundai|solar|hitachi|volvo|caterpillar|jcb|samsung|sumsung|dyna?p[ae]c/i.test(text) || CAT.test(text) || /\bdx\s*-?\s*\d{2,3}/i.test(text);
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
export function withinLimits(item: { priceEur: number | null; year: number | null }, limits: Limits, model?: WantedModel | null): boolean {
  if (limits.maxPrice != null && item.priceEur != null && !withinBudget(item.priceEur, limits.maxPrice)) return false;
  if (limits.maxYear != null && item.year != null && item.year > limits.maxYear) return false;
  if (model?.maxPriceEur != null && item.priceEur != null && !withinBudget(item.priceEur, model.maxPriceEur)) return false;
  if (model?.minYear != null && item.year != null && item.year < model.minYear) return false;
  if (model?.maxYear != null && item.year != null && item.year > model.maxYear) return false;
  return true;
}

/** Machineryline's make numbers. */
const ML_MAKE = { doosan: 3881, hyundai: 2611, yanmar: 3015, hitachi: 2604, jcb: 2618, volvo: 2819, cat: 2512, dynapac: 2544 };

/**
 * Machineryline's own filter per category and make, built up to the max year.
 * The price stays out of the URL on purpose: the site's price filter hides "Preis auf Anfrage" ads; run.ts applies it instead.
 * Page counts fit the default year limit at about 24 ads per page; a later year (or none) has more results, so read further.
 */
function machinerylinePages(mobileOnly: boolean): string[] {
  const { maxYear } = scrapeLimits();
  const scale = maxYear === DEFAULT_LIMITS.maxYear ? 1 : 3;
  const year = maxYear != null ? `ym=%3A${maxYear}&` : "";
  const { doosan, hyundai, yanmar, hitachi, jcb, volvo, cat, dynapac } = ML_MAKE;
  const search = (path: string, makes: number[], pages: number) =>
    range(pages * scale).map((n) => `https://machineryline.de/-/${path}?${year}${makes.length ? `mark_id=${makes.join("%3B")}&` : ""}page=${n}`);
  return [
    ...search("Mobilbagger--c164", [doosan, hyundai, yanmar], 4),
    ...(mobileOnly
      ? []
      : [
          ...search("Minibagger--c166", [doosan, hyundai, yanmar], 8),
          ...search("Midibagger--c5601", [doosan, hyundai, yanmar], 2),
          ...search("Kettenbagger--c167", [doosan, hyundai, yanmar], 15),
        ]),
    // Models on the list that are not only wheeled are read whatever the setting says.
    ...search("Mobilbagger--c164", [hitachi, jcb, volvo], 10),
    ...search("Kettenbagger--c167", [hitachi, jcb], 17),
    ...search("Midibagger--c5601", [hitachi, jcb], 2),
    ...search("Minibagger--c166", [hitachi], 2),
    ...search("Kettenbagger/Doosan/DX225--c167tm3881m6581", [], 3),
    ...search("Kettenbagger/Doosan/DX300--c167tm3881m6583", [], 3),
    ...search("Radlader--c180", [cat], 22),
    ...search("Grader--c130", [cat], 8),
    ...search("Walzen--c2439", [dynapac], 8),
  ];
}

/** One search whose pages are read in turn: the next page only while the last one had new ads, up to maxPages. */
export type PagedSearch = { page: (n: number) => string; maxPages: number };

export type Source = {
  id: string;
  name: string;
  enabled: boolean;
  /** search/listing page URLs to crawl for this source, all of them every run */
  urls?: (mobileOnly: boolean) => string[];
  /** searches read page by page, stopping at the first page without new ads: no fixed page counts to keep up to date */
  paged?: (mobileOnly: boolean) => PagedSearch[];
  /** the currency of the site's prices; "kr" alone means NOK, DKK or SEK depending on the site. EUR when not set */
  currency?: Currency;
  /** seconds between two pages of this site (default 3); a Crawl-delay in its robots.txt raises it */
  delaySecs?: number;
  /** false: a page that fails or looks empty is not tried again in the browser. Sites that refused are never retried there */
  browserFallback?: boolean;
  /** read through an official API instead of web pages (see scraper/mobile-de-api.ts), so the crawler skips it */
  api?: boolean;
  /** characters of a card's text kept (default 600). Sites whose cards end with the seller's town need more */
  cardChars?: number;
  /** ad addresses carry tracking that changes per page: drop the query so an ad keeps one id */
  stripQuery?: boolean;
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

const dash = (q: string) => q.trim().toLowerCase().replace(/\s+/g, "-");
const range = (n: number) => Array.from({ length: n }, (_, i) => i + 1);

/** The first page of every search of a source: what a run starts with. */
export function seedUrls(source: Source, mobileOnly: boolean): string[] {
  return [...(source.urls?.(mobileOnly) ?? []), ...(source.paged?.(mobileOnly) ?? []).map((s) => s.page(1))];
}

/**
 * What the national sites search for, inside their machinery section only: "hyundai" anywhere else finds cars.
 * Makes whose machines are all of interest are searched whole; for the big makes only the wanted models are, or every
 * Volvo, Cat and JCB machine would be read.
 */
export const NATIONAL_QUERIES = [
  "doosan",
  "develon",
  "daewoo",
  "hyundai",
  "yanmar",
  "hitachi",
  "samsung",
  "dynapac",
  "volvo ew170",
  "jcb js140",
  "jcb js145",
  "cat 966",
  "cat 970",
  "cat 972",
  "cat 980",
  "cat 120",
  "cat 130",
  "cat 140",
];

/** Leboncoin refuses after a few pages: the makes that build the wanted wheeled excavators, five pages a run in all. */
export const LEBONCOIN_QUERIES = ["doosan", "develon", "daewoo", "hyundai", "yanmar"];

/** Most of these sites read 20 to 50 ads per page, so 6 pages are plenty for one make inside the machinery section. */
const NATIONAL_MAX_PAGES = 6;

/** One paged search per query. `page(q, n)` builds the address of page n. */
const searchesFor = (page: (q: string, n: number) => string, maxPages = NATIONAL_MAX_PAGES, queries = NATIONAL_QUERIES): PagedSearch[] =>
  queries.map((q) => ({ page: (n: number) => page(q, n), maxPages }));

const plusQuery = (q: string) => encodeURIComponent(q).replace(/%20/g, "+");
const dashQuery = (q: string) => encodeURIComponent(q.replace(/\s+/g, "-"));

/**
 * For sites without a machinery section to search in: makes that also build cars get the local word for excavator, or
 * "hyundai" would read pages of cars. The model filters would turn those down anyway; this keeps the pages useful.
 */
const withMachineWord = (word: string) =>
  NATIONAL_QUERIES.flatMap((q) => (["hyundai", "daewoo", "samsung"].includes(q) ? [`${q} ${word}`, ...(q === "hyundai" ? ["hyundai robex"] : [])] : [q]));

/** Landwirt.com: one page per category and make, as the site's own make filter. */
function landwirtSearches(mobileOnly: boolean): PagedSearch[] {
  const pairs: [string, string[]][] = [
    ["mobilbagger", ["doosan", "develon", "daewoo", "hyundai", "yanmar", "hitachi", "volvo", "samsung", "jcb"]],
    ["kettenbagger", ["doosan", "develon", "daewoo", "hitachi", "jcb", ...(mobileOnly ? [] : ["hyundai"])]],
    ["minibagger", ["hitachi", ...(mobileOnly ? [] : ["doosan", "hyundai", "yanmar"])]],
    ["radlader", ["cat"]],
    ["grader", ["cat"]],
    ["walzen", ["dynapac"]],
  ];
  return pairs.flatMap(([category, makes]) =>
    makes.map((make) => ({
      page: (n: number) => `https://www.landwirt.com/baumaschinen/${category}/${make}${n > 1 ? `?page=${n}` : ""}`,
      maxPages: 5,
    })),
  );
}

/**
 * What every national site shares: words kept apart, regex parsers only (some ask in robots.txt not to be used for AI,
 * and it keeps the AI budget for the portals), no browser retries, and room for the seller's town at a card's end.
 */
const NATIONAL = { spacedText: true, ai: false, browserFallback: false, cardChars: 900 } as const;

/** Marktplaats, 2dehands and 2ememain run on one platform: a category, a query, then /p/N/. */
const adevinta = (host: string, category: string) =>
  searchesFor((q, n) => `https://${host}/l/${category}/q/${plusQuery(q)}/${n > 1 ? `p/${n}/` : ""}`);
const adevintaListing = (host: string) => (url: string) => new RegExp(String.raw`^https://${host.replace(/\./g, "\\.")}/v/[^?#]+/m\d+-`).test(url);

/** FINN, DBA and Blocket run on one platform as well (Vend). */
const vendListing = (host: string) => (url: string) =>
  new RegExp(String.raw`^https://${host.replace(/\./g, "\\.")}/(?:mobility|recommerce/forsale)/item/\d+(?:[?#]|$)`).test(url);

/** Otomoto and Autovit: OLX Group's vehicle sites, with the same layout. */
const olxGroupListing = (host: string, section: string) => (url: string) =>
  new RegExp(String.raw`^https://${host.replace(/\./g, "\\.")}/${section}/(?:oferta|anunt)/[^?#]+-ID[A-Za-z0-9]+\.html`).test(url);

/**
 * Maschinensucher's /mss/ pages by model mostly answer 404, and those that exist show loose matches, so read the
 * make pages. 25 ads per page, and the site stops at 8 pages however many ads there are (on 2026-11-07: Doosan 268,
 * Hyundai 145, Yanmar 32, Volvo 1042, Caterpillar 395, JCB 203, Hitachi 93, Daewoo 54, Dynapac 16, Samsung 2; it has no
 * Develon page). Their order changes per request, so one scrape may miss a machine that the next one finds.
 * These pages also hold lathes and forklifts: classify() turns those down. Its /main/ search is closed by robots.txt.
 */
const MASCHINENSUCHER_PAGES = { doosan: 8, hyundai: 6, yanmar: 2, volvo: 8, caterpillar: 8, jcb: 8, hitachi: 4, daewoo: 3, dynapac: 1, samsung: 1 };

/** TruckScout24 filters a make page by its own model names. A name the site does not know does no harm. */
const ts24Models = (make: string, models: string[], pages: number) =>
  range(pages).map((n) => `${TS24}/alle/${make}?${models.map((m) => `models%5B%5D=${encodeURIComponent(m)}`).join("&")}${n > 1 ? `&page=${n}` : ""}`);

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
  "doosan dx 60",
  "doosan dx60",
  "doosan dx 210",
  "doosan dx210",
  "doosan dx 160",
  "doosan dx160",
  "doosan dx 190",
  "doosan dx190",
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
  "doosan dx 60 w",
  "doosan dx 160 w",
  "doosan dx160w",
  "doosan dx 190 w",
  "doosan dx190w",
  "doosan dx 210 w",
  "doosan dx210w",
  "hyundai r 55 w",
  "hyundai r 140 w",
  "hyundai robex 140 w",
  "radbagger doosan",
  "radbagger hyundai",
  // wheeled sizes from the owner's list of 2026-11-07
  "doosan dx 57 w",
  "doosan dx57w",
  "doosan dx 170 w",
  "doosan dx170w",
  "doosan dh 130 w",
  "doosan dh130w",
  "solar 55 w",
  "solar 80 w",
  "solar 130 w",
  "solar 140 w",
  "solar 170 w",
  "daewoo solar 130 w",
  "daewoo solar 140 w",
  "daewoo solar 170 w",
  "hyundai robex 130 w",
  "hyundai r130w",
  "volvo ew 170",
  "samsung 130 w",
  "samsung mx 132 w",
  "samsung mx132w",
  "samsung mx 6 w",
  "samsung mx6w",
];

/** The rest of that list: not only wheeled, so these run whatever the "only scrape Mobilbagger" setting says. */
const ANY_TYPE_QUERIES = [
  "volvo ew170",
  "doosan dx 225",
  "doosan dx225",
  "doosan dx 300",
  "doosan dx300",
  "solar 130 lc",
  "solar 225",
  "solar 300",
  "hitachi ex 60",
  "hitachi ex60",
  "hitachi ex 100",
  "hitachi ex100",
  "hitachi ex 120",
  "hitachi ex120",
  "hitachi ex 160 wd",
  "hitachi ex160wd",
  "jcb js 140",
  "jcb js140",
  "jcb js 145",
  "jcb js145",
  "cat grader 120",
  "cat grader 130",
  "cat grader 140",
  "caterpillar grader",
  "cat 966f",
  "cat 966g",
  "cat 970f",
  "cat 972g",
  "cat 972h",
  "cat 980g",
  "cat 980h",
  "dynapac walze",
  "dynapac ca 2510",
  "dynapac ca2510",
];

/** Searches aimed at wheeled machines: they name the type or end in the "W" of the model. */
const isMobileQuery = (q: string) => /mobilbagger|radbagger|(?:\s|\d)w$/.test(q);
const queriesFor = (queries: string[], mobileOnly: boolean) => [...(mobileOnly ? queries.filter(isMobileQuery) : queries), ...ANY_TYPE_QUERIES];

const TS24 = "https://www.truckscout24.de/baumaschinen/gebraucht";
export const SOURCES: Source[] = [
  {
    id: "maschinensucher",
    name: "Maschinensucher",
    enabled: true,
    languages: ["de"],
    defaultCountry: "Deutschland",
    isListing: (url) => /\/i-\d+(?:\?|$)/.test(url),
    urls: () =>
      Object.entries(MASCHINENSUCHER_PAGES).flatMap(([make, pages]) =>
        range(pages).map((n) => `https://www.maschinensucher.de/mss/${make}${n > 1 ? `?page=${n}` : ""}`),
      ),
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
      // The other makes: the site shows a whole make whichever category is asked for (see TODO.md), so read the make once.
      ...range(5).map((n) => `${TS24}/alle/hitachi${n > 1 ? `?page=${n}` : ""}`),
      `${TS24}/alle/daewoo`,
      ...range(2).map((n) => `${TS24}/walze/dynapac${n > 1 ? `?page=${n}` : ""}`),
      // 592 Caterpillar, 585 JCB and 2025 Volvo ads on 2026-11-07, so these ask for the models.
      ...ts24Models("caterpillar", ["120", "120G", "120H", "120K", "120M", "130G", "130H", "140", "140 AWD", "140G", "140H", "140K", "140M"], 1),
      ...ts24Models("caterpillar", ["966", "966F", "966G", "970", "970F", "972", "972G", "972H", "980", "980G", "980H"], 2),
      ...ts24Models("jcb", ["JS140", "JS145", "JS145 LC", "JS145W"], 1),
      ...ts24Models("volvo", ["EW170"], 1),
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
    isListing: (url) =>
      /\/-\/Verkauf\/(?:Mobilbagger|Minibagger|Midibagger|Kettenbagger|Bagger|Radlader|Grader|Strassenwalzen|Walzenzuge|kleine-Walzen|Kombiwalzen|Gummiradwalzen|Anhangewalzen|Walzen)\/.+--\d{10,}$/.test(url),
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
    // 40 ads per page. Pages fit the counts on 2026-11-07, plus one to allow for growth. "make,word,1,relevance,search.html" is
    // the site's own model filter; it only exists for words the site offers, so there is none for the Cat 970F or Volvo EW170.
    urls: (mobileOnly) =>
      Object.entries({
        "mobilbagger/hyundai": 7,
        "mobilbagger/doosan": 6,
        "mobilbagger/develon": 2,
        "mobilbagger/yanmar": 3,
        "mobilbagger/hitachi": 6,
        "mobilbagger/volvo": 9,
        "mobilbagger/daewoo": 1,
        "mobilbagger/samsung": 1,
        "raupenbagger/samsung": 1,
        "raupenbagger/daewoo": 1,
        "raupenbagger/develon": 3,
        "raupenbagger/doosan,dx225": 8,
        "raupenbagger/doosan,dx300": 5,
        "raupenbagger/hitachi,ex60": 1,
        "raupenbagger/hitachi,ex100": 1,
        "raupenbagger/hitachi,ex120": 1,
        "raupenbagger/jcb,js145": 1,
        "raupenbagger/jcb,140x": 1,
        "grader/cat,120": 2,
        "grader/cat,130": 1,
        "grader/cat,140": 13,
        "radlader/cat,966": 13,
        "radlader/cat,972": 5,
        "radlader/cat,980": 7,
        "walzen/dynapac": 11,
        ...(mobileOnly ? {} : { "raupenbagger/doosan,dx140": 5 }),
      }).flatMap(([path, pages]) =>
        range(pages).map((n) => {
          const base = `https://www.mascus.de/baumaschinen/${path}`;
          if (path.includes(",")) return `${base},${n},relevance,search.html`;
          return `${base}${n > 1 ? `?page=${n}` : ""}`;
        }),
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
    // About 20 ads per page. Pages fit the counts on 2026-11-07, plus room for growth.
    urls: (mobileOnly) =>
      Object.entries({
        "hyundai-wheel-excavator/~a2b1c3e355/used.html": 4,
        "doosan-wheel-excavator/~a2b1c3e803/used.html": 4,
        "develon-wheel-excavator/~a2b1c3e7872/used.html": 1,
        "yanmar-wheel-excavator/~a2b1c3e788/used.html": 2,
        "hitachi-wheel-excavator/~a2b1c3e338/used.html": 4,
        "volvo-wheel-excavator/~a2b1c3e774/used.html": 4,
        "doosan-crawler-excavator/~a2b1c2e803/used.html": 9,
        "develon-crawler-excavator/~a2b1c2e7872/used.html": 2,
        "hitachi-crawler-excavator/~a2b1c2e338/used.html": 16,
        "jcb-crawler-excavator/~a2b1c2e384/used.html": 4,
        "caterpillar-wheel-loader/~a2b3c12e133/used.html": 24,
        "caterpillar-grader/2-6-133/used-caterpillar-grader.html": 9,
        "dynapac-compactor/2-9-212/used-dynapac-compactor.html": 7,
        ...(mobileOnly ? {} : { "hyundai-crawler-excavator/~a2b1c2e355/used.html": 4 }),
      }).flatMap(([path, pages]) =>
        range(pages).map((n) => `https://www.europe-construction-equipment.com/${path}${n > 1 ? `?p=${n}` : ""}`),
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
    isListing: (url) => /truck1\.eu\/construction-machinery\/[a-z-]+\/.+-a\d{5,}\.html(?:\?|$)/.test(url),
    // Up to 31 ads per page; robots.txt allows ?page=. The wheeled Hyundai, Doosan, Develon and Yanmar pages fit the counts
    // on 2026-11-07 (112, 83, 7, 4), plus one. The other page counts are estimates: an empty page costs only a little time.
    urls: () =>
      Object.entries({
        "wheel-excavators/hyundai": 5,
        "wheel-excavators/doosan": 4,
        "wheel-excavators/develon": 1,
        "wheel-excavators/yanmar": 1,
        "wheel-excavators/hitachi": 2,
        "wheel-excavators/volvo": 4,
        "crawler-excavators/doosan": 6,
        "crawler-excavators/develon": 1,
        "crawler-excavators/hitachi": 6,
        "crawler-excavators/jcb": 3,
        "wheel-loaders/caterpillar": 12,
        "graders/caterpillar": 3,
        "road-rollers/dynapac": 3,
      }).flatMap(([path, pages]) =>
        range(pages).map((n) => `https://www.truck1.eu/construction-machinery/${path}${n > 1 ? `?page=${n}` : ""}`),
      ),
  },

  // ---- National sites (reports/Used wheel excavator sources Europe.md), checked on 2026-11-07 ------------------
  // All use the regex parsers only (ai: false): some ask in robots.txt not to be used for AI, and it keeps the
  // AI budget for the portals. Each one's searches page on demand, so no page counts need keeping up to date.
  {
    id: "landwirt",
    name: "Landwirt.com",
    enabled: true,
    languages: ["de"],
    defaultCountry: "Österreich",
    ...NATIONAL,
    isListing: (url) => /^https:\/\/www\.landwirt\.com\/detail\/[a-z0-9-]+-\d{5,}(?:[?#]|$)/.test(url),
    paged: landwirtSearches,
  },
  {
    id: "marktplaats",
    name: "Marktplaats",
    enabled: true,
    languages: ["nl"],
    defaultCountry: "Nederland",
    ...NATIONAL,
    cardChars: 1400, // the town comes after a long description
    isListing: adevintaListing("www.marktplaats.nl"),
    paged: () => adevinta("www.marktplaats.nl", "zakelijke-goederen/machines-en-bouw-kranen-en-graafmachines"),
  },
  {
    id: "2dehands",
    name: "2dehands",
    enabled: true,
    languages: ["nl"],
    defaultCountry: "België",
    ...NATIONAL,
    cardChars: 1400,
    isListing: adevintaListing("www.2dehands.be"),
    paged: () => adevinta("www.2dehands.be", "zakelijke-goederen/machines-en-bouw-kranen-en-graafmachines"),
  },
  {
    id: "2ememain",
    name: "2ememain",
    enabled: true,
    languages: ["fr", "nl"],
    defaultCountry: "Belgique",
    ...NATIONAL,
    cardChars: 1400,
    isListing: adevintaListing("www.2ememain.be"),
    paged: () => adevinta("www.2ememain.be", "articles-professionnels/machines-construction-grues-excavatrices"),
  },
  {
    // Searches are paths (robots.txt closes ?hledat=), one page of 40 ads each: Bazos has no allowed next page.
    id: "bazos-cz",
    name: "Bazoš.cz",
    enabled: true,
    languages: ["cs"],
    defaultCountry: "Česko",
    currency: "CZK",
    ...NATIONAL,
    isListing: (url) => /^https:\/\/stroje\.bazos\.cz\/inzerat\/\d+\//.test(url),
    paged: () => searchesFor((q) => `https://stroje.bazos.cz/inzeraty/${dashQuery(q)}/`, 1),
  },
  {
    id: "bazos-sk",
    name: "Bazoš.sk",
    enabled: true,
    languages: ["sk"],
    defaultCountry: "Slovensko",
    ...NATIONAL,
    isListing: (url) => /^https:\/\/stroje\.bazos\.sk\/inzerat\/\d+\//.test(url),
    paged: () => searchesFor((q) => `https://stroje.bazos.sk/inzeraty/${dashQuery(q)}/`, 1),
  },
  {
    id: "otomoto",
    name: "Otomoto",
    enabled: true,
    languages: ["pl"],
    defaultCountry: "Polska",
    currency: "PLN",
    ...NATIONAL,
    isListing: olxGroupListing("www.otomoto.pl", "maszyny-budowlane"),
    paged: () => searchesFor((q, n) => `https://www.otomoto.pl/maszyny-budowlane/q-${dashQuery(q)}${n > 1 ? `?page=${n}` : ""}`),
  },
  {
    id: "autovit",
    name: "Autovit",
    enabled: true,
    languages: ["ro"],
    defaultCountry: "România",
    currency: "RON",
    ...NATIONAL,
    isListing: olxGroupListing("www.autovit.ro", "utilaje-constructii"),
    paged: () => searchesFor((q, n) => `https://www.autovit.ro/utilaje-constructii/q-${dashQuery(q)}${n > 1 ? `?page=${n}` : ""}`),
  },
  {
    // robots.txt bars AI training bots from the ad pages, and allows only ?o=1 to 9.
    id: "jofogas",
    name: "Jófogás Auto",
    enabled: true,
    languages: ["hu"],
    defaultCountry: "Magyarország",
    currency: "HUF",
    ...NATIONAL,
    isListing: (url) => /^https:\/\/auto\.jofogas\.hu\/[a-z_]+\/[^/?#]+_\d{6,}\.htm/.test(url),
    paged: () =>
      searchesFor((q, n) => `https://auto.jofogas.hu/magyarorszag/jarmu?q=${plusQuery(q)}${n > 1 ? `&o=${n}` : ""}`, 5, withMachineWord("kotró")),
  },
  {
    // robots.txt: Crawl-delay 10 and ai-train=no. The site has no search inside a category, so the excavator category is read whole.
    id: "agroinform",
    name: "Agroinform",
    enabled: true,
    languages: ["hu"],
    defaultCountry: "Magyarország",
    currency: "HUF",
    delaySecs: 10,
    ...NATIONAL,
    stripQuery: true, // its ad links carry a ?ref= that changes from page to page
    isListing: (url) => /^https:\/\/www\.agroinform\.hu\/aprohirdetes_adatlap\/[^?#]+\/h_\d+/.test(url),
    paged: () => [
      {
        page: (n: number) =>
          `https://www.agroinform.hu/aprohirdetes/gep/rakodogepek-es-epitoipari-gepek/onjaro-forgogemes-rakodo-10991/${n > 1 ? `oldal:${n}/c3l1` : "c3"}`,
        maxPages: 12,
      },
    ],
  },
  {
    // The dealer section: the consumer one is mostly parts and toys (report).
    id: "finn",
    name: "FINN",
    enabled: true,
    languages: ["no"],
    defaultCountry: "Norge",
    currency: "NOK",
    ...NATIONAL,
    isListing: vendListing("www.finn.no"),
    paged: () => searchesFor((q, n) => `https://www.finn.no/mobility/search/b2b/construction?q=${plusQuery(q)}${n > 1 ? `&page=${n}` : ""}`),
  },
  {
    id: "dba",
    name: "DBA",
    enabled: true,
    languages: ["da"],
    defaultCountry: "Danmark",
    currency: "DKK",
    ...NATIONAL,
    isListing: vendListing("www.dba.dk"),
    paged: () =>
      searchesFor((q, n) => `https://www.dba.dk/recommerce/forsale/search?q=${plusQuery(q)}${n > 1 ? `&page=${n}` : ""}`, 3, withMachineWord("gravemaskine")),
  },
  {
    id: "blocket",
    name: "Blocket",
    enabled: true,
    languages: ["sv"],
    defaultCountry: "Sverige",
    currency: "SEK",
    ...NATIONAL,
    isListing: vendListing("www.blocket.se"),
    paged: () => searchesFor((q, n) => `https://www.blocket.se/mobility/search/b2b/construction?q=${plusQuery(q)}${n > 1 ? `&page=${n}` : ""}`),
  },
  {
    // The construction machine category: free text alone does not narrow results here (report).
    id: "maskinbladet",
    name: "Maskinbladet",
    enabled: true,
    languages: ["da"],
    defaultCountry: "Danmark",
    currency: "DKK",
    ...NATIONAL,
    isListing: (url) => /^https:\/\/www\.maskinbladet\.dk\/maskiner\/[a-z0-9-]+\/[a-z0-9-]+-d[0-9a-f]{8}-[0-9a-f-]+$/i.test(url),
    paged: () =>
      searchesFor(
        (q, n) => `https://www.maskinbladet.dk/maskiner/entrepren-rmaskiner-cf268d600-625f-4650-ab91-b3cfef4c9f0d?query=${plusQuery(q)}${n > 1 ? `&p=${n}` : ""}`,
      ),
  },
  {
    // Machines only, so a make page holds no cars. The big makes are left out: their pages are mostly other machines.
    id: "nettikone",
    name: "Nettikone",
    enabled: true,
    languages: ["fi"],
    defaultCountry: "Suomi",
    ...NATIONAL,
    // Only the plain address: the same card also links to "#video_show" and "?video_display=Y".
    isListing: (url) => /^https:\/\/www\.nettikone\.com\/[a-z0-9-]+\/[a-z0-9-]+\/\d{5,}$/.test(url),
    paged: () =>
      ["doosan", "develon", "daewoo", "hyundai", "yanmar", "hitachi", "samsung", "dynapac"].map((make) => ({
        page: (n: number) => `https://www.nettikone.com/${make}${n > 1 ? `?page=${n}` : ""}`,
        maxPages: NATIONAL_MAX_PAGES,
      })),
  },
  {
    id: "subito",
    name: "Subito",
    enabled: true,
    languages: ["it"],
    defaultCountry: "Italia",
    ...NATIONAL,
    isListing: (url) => /^https:\/\/www\.subito\.it\/[a-z-]+\/[^?#]+-\d{7,}\.htm/.test(url),
    paged: () =>
      searchesFor((q, n) => `https://www.subito.it/annunci-italia/vendita/usato/?q=${plusQuery(q)}${n > 1 ? `&o=${n}` : ""}`, 3, withMachineWord("escavatore")),
  },
  {
    id: "leboncoin",
    name: "Leboncoin",
    enabled: true,
    languages: ["fr"],
    defaultCountry: "France",
    ...NATIONAL,
    isListing: (url) => /^https:\/\/www\.leboncoin\.fr\/ad\/[a-z_]+\/\d+(?:[?#]|$)/.test(url),
    // It refused (HTTP 403) after 6 pages on 2026-11-08, so it gets the main excavator makes only, one page each, slowly.
    delaySecs: 10,
    paged: () =>
      searchesFor(
        (q, n) => `https://www.leboncoin.fr/ck/btp_chantier_gros_oeuvre/${encodeURIComponent(q)}${n > 1 ? `?page=${n}` : ""}`,
        1,
        LEBONCOIN_QUERIES,
      ),
  },
  {
    // Outside the EU: customs and import VAT come on top of the price.
    id: "autotrader",
    name: "Autotrader Plant",
    enabled: true,
    languages: ["en"],
    defaultCountry: "United Kingdom",
    currency: "GBP",
    ...NATIONAL,
    isListing: (url) => /^https:\/\/www\.autotrader\.co\.uk\/plant-machinery-details\/\d+/.test(url),
    paged: () =>
      ["DOOSAN", "DEVELON", "DAEWOO", "HYUNDAI", "YANMAR", "HITACHI", "VOLVO", "JCB", "SAMSUNG"].map((make) => ({
        page: (n: number) => `https://www.autotrader.co.uk/plant/plant-machinery/excavators?make=${make}${n > 1 ? `&page=${n}` : ""}`,
        maxPages: NATIONAL_MAX_PAGES,
      })),
  },
  {
    // Official Search-API, once mobile.de grants an API-Account (scraper/mobile-de-api.ts). Without credentials it does nothing.
    id: "mobile-de",
    name: "mobile.de",
    enabled: !!(process.env.MOBILE_DE_API_USER && process.env.MOBILE_DE_API_PASSWORD),
    api: true,
    languages: ["de"],
    defaultCountry: "Deutschland",
    ai: false,
  },
];
