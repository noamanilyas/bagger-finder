/**
 * Machines sent by an external system (POST /api/ingest). Each one goes through the same rules as a scraped ad:
 * the wanted models, the price and year limits, the Mobilbagger setting and the European area. Accepted machines are
 * geocoded, compared with the market and stored like scraped listings, under the same id an ad with that address
 * gets from the scraper, so a machine that is both sent and scraped is stored once.
 */
import { isWheeled, matchModel, scrapeLimits, WANTED, withinLimits, fitsMobileOnly, type WantedModel } from "./config";
import { expandCountryCode, inEurope, isExcludedPlace } from "./countries";
import { isCurrency, setEurRates, toEur, type Currency } from "./currency";
import { loadEurRates } from "./fx";
import { listingId, normalizeUrl } from "./listing-id";
import { applyMarket } from "./market";
import { loadSettings } from "./settings";
import { readDb, readGeoCache, writeDb } from "./store";
import { hasSupabase, loadListings, recordHistory, saveListings } from "./supabase";
import type { AdType, Listing } from "./types";
import { geocode } from "../scraper/geocode";
import { isPhoto } from "../scraper/images";

/** Most machines one request may carry. */
export const MAX_MACHINES_PER_REQUEST = 500;

const AD_TYPES: AdType[] = ["sale", "rental", "parts", "other"];

/** A machine as the external system sends it, checked and cleaned. */
export type IncomingMachine = {
  url: string;
  title: string;
  description: string | null;
  make: string | null;
  model: string | null;
  /** a key from lib/config.ts WANTED; otherwise the model is matched from the text, as for scraped ads */
  modelKey: string | null;
  source: string;
  price: number | null;
  currency: Currency;
  year: number | null;
  hours: number | null;
  location: string | null;
  lat: number | null;
  lng: number | null;
  imageUrl: string | null;
  adType: AdType;
};

const text = (v: unknown, max = 5000): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isFinite(n) ? n : null;
};

/** Checks one machine. Returns the cleaned machine, or what is wrong with it. */
export function parseMachine(input: unknown): IncomingMachine | string {
  if (!input || typeof input !== "object" || Array.isArray(input)) return "not an object";
  const m = input as Record<string, unknown>;

  const url = text(m.url ?? m.link, 2000);
  if (!url) return "url is required";
  try {
    const u = new URL(url);
    if (u.protocol !== "http:" && u.protocol !== "https:") return "url must be http(s)";
  } catch {
    return "url is not a valid address";
  }
  const title = text(m.title, 500);
  if (!title) return "title is required";

  const currency = m.currency == null ? "EUR" : String(m.currency).toUpperCase();
  if (!isCurrency(currency)) return `currency must be one of EUR, PLN, CZK, HUF, RON, NOK, DKK, SEK, GBP, CHF`;

  const adType = m.adType == null ? "sale" : String(m.adType);
  if (!AD_TYPES.includes(adType as AdType)) return `adType must be one of ${AD_TYPES.join(", ")}`;

  const modelKey = text(m.modelKey, 100);
  if (modelKey && !WANTED.some((w) => w.key === modelKey)) return `unknown modelKey "${modelKey}"`;

  const lat = num(m.lat);
  const lng = num(m.lng);
  if ((lat == null) !== (lng == null)) return "lat and lng must be sent together";

  const year = num(m.year);
  const imageUrl = text(m.imageUrl ?? m.image, 2000);
  return {
    url,
    title,
    description: text(m.description),
    make: text(m.make, 100),
    model: text(m.model, 100),
    modelKey,
    source: text(m.source, 100) ?? "External",
    price: num(m.price ?? m.priceEur),
    currency,
    year: year == null ? null : Math.round(year),
    hours: num(m.hours),
    location: text(m.location, 300),
    lat,
    lng,
    imageUrl: imageUrl && /^https?:\/\//i.test(imageUrl) && isPhoto(imageUrl) ? imageUrl : null,
    adType: adType as AdType,
  };
}

export type IngestResult = {
  /** stored machines: new ones and ones already stored, which are updated */
  stored: { index: number; id: string; url: string; created: boolean }[];
  /** machines left out, with the reason */
  rejected: { index: number; url: string | null; reason: string }[];
};

/** One ingest at a time: the local listings file is read, changed and written whole. */
let queue: Promise<unknown> = Promise.resolve();

export function ingestMachines(inputs: unknown[]): Promise<IngestResult> {
  const run = queue.then(() => ingest(inputs));
  queue = run.catch(() => undefined);
  return run;
}

async function ingest(inputs: unknown[]): Promise<IngestResult> {
  const result: IngestResult = { stored: [], rejected: [] };
  const now = new Date().toISOString();
  const settings = await loadSettings();
  const limits = scrapeLimits();
  setEurRates(await loadEurRates());

  const all = hasSupabase() ? await loadListings() : readDb().listings;
  const byId = new Map(all.map((l) => [l.id, l]));
  const storedBefore = new Set(byId.keys());
  const cache = readGeoCache();
  const changed = new Set<string>();

  for (const [index, input] of inputs.entries()) {
    const m = parseMachine(input);
    if (typeof m === "string") {
      const url = input && typeof input === "object" ? text((input as Record<string, unknown>).url) : null;
      result.rejected.push({ index, url, reason: m });
      continue;
    }
    const reject = (reason: string) => result.rejected.push({ index, url: m.url, reason });

    const label = `${m.title} ${m.make ?? ""} ${m.model ?? ""}`;
    const wanted: WantedModel | null =
      WANTED.find((w) => w.key === m.modelKey) ?? matchModel(label) ?? matchModel(`${label} ${m.description ?? ""}`);
    if (!wanted) {
      reject("not one of the wanted models (send modelKey, or name the make and model in the title)");
      continue;
    }
    const priceEur = m.currency === "EUR" ? m.price : toEur(m.price, m.currency);
    if (m.price != null && priceEur == null) {
      reject(`no exchange rate for ${m.currency}`);
      continue;
    }
    if (!withinLimits({ priceEur, year: m.year }, limits, wanted)) {
      reject("outside the price or year limits");
      continue;
    }
    const allText = [m.title, m.make, m.model, m.description].filter(Boolean).join(" ");
    if (settings.mobileOnly && !fitsMobileOnly(wanted, allText, m.title)) {
      reject("not a wheeled machine, and the scraper is set to Mobilbagger only");
      continue;
    }
    const location = expandCountryCode(m.location);
    if (isExcludedPlace(location)) {
      reject("located outside the search area");
      continue;
    }

    const url = normalizeUrl(m.url);
    const id = listingId(url);
    const prev = byId.get(id);
    const coords =
      m.lat != null && m.lng != null
        ? { lat: m.lat, lng: m.lng }
        : prev && prev.location === location && prev.lat != null
          ? { lat: prev.lat, lng: prev.lng! }
          : await geocode(location, cache, null);
    if (coords && !inEurope(coords)) {
      reject("located outside Europe");
      continue;
    }

    const listing: Listing = {
      id,
      url,
      source: m.source,
      title: m.title,
      description: m.description ?? "",
      make: m.make,
      model: m.model,
      modelKey: wanted.key,
      modelLabel: wanted.label,
      wheeled: isWheeled(allText, m.title),
      priceEur,
      priceAmount: m.currency === "EUR" ? null : m.price,
      priceCurrency: m.currency === "EUR" ? null : m.currency,
      year: m.year,
      hours: m.hours,
      location,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      imageUrl: m.imageUrl ?? prev?.imageUrl ?? null,
      firstSeen: prev?.firstSeen ?? now,
      lastSeen: now,
      cardHash: prev?.cardHash ?? null,
      cardText: prev?.cardText ?? allText.slice(0, 2000),
      adType: m.adType,
      issues: prev?.issues ?? null,
      priceNote: prev?.priceNote ?? null,
      marketMedian: null, // set by applyMarket below
      marketCount: null,
      belowPct: null,
      flagged: false,
      aiVerdict: prev?.aiVerdict ?? null,
      aiReason: prev?.aiReason ?? null,
      aiModel: prev?.aiModel ?? null,
      aiCheckKey: prev?.aiCheckKey ?? null,
    };
    byId.set(id, listing);
    changed.add(id);
    // A machine sent twice in one request is stored once, with the later values.
    const earlier = result.stored.findIndex((s) => s.id === id);
    if (earlier >= 0) result.stored.splice(earlier, 1);
    result.stored.push({ index, id, url, created: !storedBefore.has(id) });
  }

  if (changed.size === 0) return result;
  // Compared with all stored machines, as after a scrape.
  const listings = applyMarket([...byId.values()]);
  const sent = listings.filter((l) => changed.has(l.id));
  if (hasSupabase()) {
    await saveListings(sent);
    try {
      await recordHistory(sent, now);
    } catch (err) {
      console.warn(`[ingest] history not recorded: ${(err as Error).message}`);
    }
  }
  writeDb({ updatedAt: now, listings }); // local copy / fallback
  console.log(`[ingest] ${sent.length} stored, ${result.rejected.length} rejected`);
  return result;
}
