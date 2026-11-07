/**
 * mobile.de through its official Search-API (https://services.mobile.de/docs/search-api.html). Its website refuses
 * the crawler and robots.txt closes its search pages, so this is the only way in. It needs an API-Account, which
 * mobile.de's customer support activates; without MOBILE_DE_API_USER and MOBILE_DE_API_PASSWORD this does nothing.
 *
 * Written from the documentation, before any credentials existed: field names and the make filter are unverified.
 * The mapping is defensive (a missing or differently shaped field becomes null), and the first run with real
 * credentials should be checked with `npm run try-source -- mobile-de`.
 */
import type { Limits } from "../lib/config";
import { isCurrency } from "../lib/currency";
import { parseRetryAfter } from "../lib/source-health";
import type { Extracted } from "./extract";

const BASE = "https://services.mobile.de/search-api";
const ACCEPT = "application/vnd.de.mobile.api+json";
/** The API's largest page. */
const PAGE_SIZE = 100;
/** The API stops at 2,000 ads per query; the newest 1,000 per category are plenty between two runs. */
const MAX_PAGES = 10;
/** One request at a time, with this gap. mobile.de publishes no limit, so stay well below any likely one. */
const GAP_MS = 2000;
const TIMEOUT_MS = 30_000;

/** mobile.de's construction machine categories, with the German word our model filters know them by. */
const CATEGORIES = {
  MobileDigger: "Mobilbagger",
  MiniDigger: "Minibagger",
  CaterpillarDigger: "Kettenbagger",
  WheeledLoader: "Radlader",
  Grader: "Grader",
  Roller: "Walze",
} as const;
type Category = keyof typeof CATEGORIES;

export const hasMobileDeAccess = () => !!(process.env.MOBILE_DE_API_USER && process.env.MOBILE_DE_API_PASSWORD);

/** Wheeled excavators only in "Mobilbagger only" mode; loaders, graders and rollers always, as for the other sites. */
export const categoriesFor = (mobileOnly: boolean): Category[] =>
  mobileOnly ? ["MobileDigger", "WheeledLoader", "Grader", "Roller"] : (Object.keys(CATEGORIES) as Category[]);

/**
 * The search address for one page. No price filter: like Machineryline's, it would drop ads without a price, and the
 * budget allows for negotiation, which run.ts applies. The year limit is safe to send.
 */
export function searchUrl(category: Category, page: number, limits: Pick<Limits, "maxYear">): string {
  const q = new URLSearchParams({
    classification: "refdata/classes/ConstructionMachine",
    category,
    condition: "USED",
    "sort.field": "modificationTime",
    "sort.order": "DESCENDING",
    "page.size": String(PAGE_SIZE),
    "page.number": String(page),
  });
  if (limits.maxYear != null) q.set("constructionYear.max", String(limits.maxYear));
  return `${BASE}/search?${q}`;
}

type Json = Record<string, unknown>;
const obj = (v: unknown): Json | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Json) : null);
const at = (v: unknown, ...path: string[]): unknown => path.reduce<unknown>((o, k) => obj(o)?.[k], v);
const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : typeof v === "number" ? String(v) : null);
/** A number, a numeric string, or an object holding one ({ amount } or { value }). */
const num = (v: unknown): number | null => {
  const inner = obj(v) ? (at(v, "amount") ?? at(v, "value") ?? at(v, "localized")) : v;
  const n = typeof inner === "number" ? inner : typeof inner === "string" ? Number(inner.replace(/[^\d.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
};
const yearOf = (v: unknown): number | null => {
  const m = str(v)?.match(/(?:19|20)\d{2}/);
  return m ? Number(m[0]) : null;
};

export type MobileDeAd = { item: Extracted; cardText: string; coords?: { lat: number; lng: number } };

/** One ad of a search result in our shape, or null when it has no address to link to. */
export function mapMobileDeAd(ad: unknown, category: Category): MobileDeAd | null {
  const url = str(at(ad, "detailPageUrl"));
  if (!url) return null;
  const make = str(at(ad, "make")) ?? str(at(ad, "vehicle", "make"));
  const model = str(at(ad, "model")) ?? str(at(ad, "modelDescription")) ?? str(at(ad, "vehicle", "model")) ?? str(at(ad, "vehicle", "modelDescription"));
  const word = CATEGORIES[category];
  const title = [make, model].filter(Boolean).join(" ") || word;

  const price = at(ad, "price");
  const gross = num(at(price, "consumerPriceGross"));
  const net = num(at(price, "consumerPriceNet"));
  const currency = str(at(price, "currency"))?.toUpperCase() ?? "EUR";
  const foreign = currency !== "EUR" && isCurrency(currency);
  const amount = gross ?? net;

  const address = at(ad, "seller", "address");
  const town = [str(at(address, "zipcode")), str(at(address, "city"))].filter(Boolean).join(" ");
  const country = str(at(address, "country-code")) ?? str(at(address, "countryCode")) ?? str(at(address, "country"));
  const location = [town, country && country !== "DE" ? country : null].filter(Boolean).join(", ") || null;

  const geo = at(ad, "seller", "geoData") ?? at(ad, "geoData");
  const lat = Number(at(geo, "lat") ?? at(geo, "latitude"));
  const lng = Number(at(geo, "lon") ?? at(geo, "lng") ?? at(geo, "longitude"));
  const coords = Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0) ? { lat, lng } : undefined;

  const images = at(ad, "images");
  const first = Array.isArray(images) ? images[0] : null;
  const imageUrl = str(at(first, "l")) ?? str(at(first, "m")) ?? str(at(first, "xl")) ?? null;
  const description = str(at(ad, "description"))?.slice(0, 280) ?? null;

  const item: Extracted = {
    url,
    title,
    description: description ?? `${word} ${title}`,
    make,
    model,
    priceEur: foreign ? null : amount,
    priceAmount: foreign ? amount : null,
    priceCurrency: foreign ? (currency as Extracted["priceCurrency"]) : null,
    year: num(at(ad, "constructionYear")) ?? yearOf(at(ad, "firstRegistration")),
    hours: num(at(ad, "operatingHours")),
    location,
    imageUrl: imageUrl && /^https?:\/\//.test(imageUrl) ? imageUrl : imageUrl ? `https://${imageUrl.replace(/^\/\//, "")}` : null,
    adType: "sale",
    issues: null,
    // The gross price is what the site shows first; the net one is noted for buyers who can reclaim VAT.
    priceNote: gross != null && net != null && net !== gross ? `net €${net.toLocaleString("de-DE")} (excl. VAT)` : gross == null && net != null ? "excl. VAT" : null,
  };
  // The category word lets the model filters tell a Mobilbagger from a crawler, as a card's text would.
  const cardText = [word, title, item.priceEur ?? item.priceAmount, item.year, item.hours && `${item.hours} h`, location, description].filter(Boolean).join(" ");
  return { item, cardText, coords };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Reads every category, newest ads first. Stops all reading on a refusal or a rate limit. */
export async function fetchMobileDe(mobileOnly: boolean, limits: Limits): Promise<{ ads: MobileDeAd[]; requests: number }> {
  const auth = Buffer.from(`${process.env.MOBILE_DE_API_USER}:${process.env.MOBILE_DE_API_PASSWORD}`).toString("base64");
  const ads: MobileDeAd[] = [];
  let requests = 0;
  for (const category of categoriesFor(mobileOnly)) {
    for (let page = 1; page <= MAX_PAGES; page++) {
      if (requests > 0) await sleep(GAP_MS);
      requests++;
      const res = await fetch(searchUrl(category, page, limits), {
        headers: { Authorization: `Basic ${auth}`, Accept: ACCEPT, "Accept-Language": "de" },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (res.status === 401 || res.status === 403) throw new Error(`mobile.de API refused the credentials (HTTP ${res.status})`);
      if (res.status === 429) {
        const wait = parseRetryAfter(res.headers.get("retry-after"));
        console.warn(`[mobile.de] rate limited${wait != null ? `, asked to wait ${Math.round(wait / 1000)} s` : ""}: stopping for this run`);
        return { ads, requests };
      }
      if (!res.ok) throw new Error(`mobile.de API HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as Json;
      const list = Array.isArray(body.ads) ? body.ads : [];
      for (const ad of list) {
        const mapped = mapMobileDeAd(ad, category);
        if (mapped) ads.push(mapped);
      }
      const maxPages = Number(body.maxPages);
      if (list.length < PAGE_SIZE || (Number.isFinite(maxPages) && page >= maxPages)) break;
    }
  }
  return { ads, requests };
}
