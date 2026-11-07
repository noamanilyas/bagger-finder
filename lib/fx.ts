import type { PkrRate } from "./costs";
import { CURRENCIES, type EurRates } from "./currency";
import { readFxCache, writeFxCache } from "./store";

const REFRESH_MS = 60 * 60_000;
const TIMEOUT_MS = 5_000;
/** The rate differs by sending country; machines leave through Rotterdam. */
const SENDER_COUNTRY = "NL";

const usable = (n: unknown): number | null => {
  const rate = Number(n);
  return Number.isFinite(rate) && rate > 0 ? rate : null;
};

type TapTapRates = {
  availableCountries?: {
    isoCountryCode: string;
    currency: string;
    corridors?: { isoCountryCode: string; currency: string; fxRate: string }[];
  }[];
};

export function parseTapTapRate(json: TapTapRates, senderCountry = SENDER_COUNTRY): number | null {
  const sender = json.availableCountries?.find((c) => c.isoCountryCode === senderCountry && c.currency === "EUR");
  const corridor = sender?.corridors?.find((c) => c.isoCountryCode === "PK" && c.currency === "PKR");
  return usable(corridor?.fxRate);
}

export function parseMarketRate(json: { rates?: { PKR?: unknown } }): number | null {
  return usable(json.rates?.PKR);
}

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

/** The feed behind Tap Tap Send's own rate calculator. It is not a documented API, so it can change without notice. */
async function tapTapRate(): Promise<number | null> {
  return parseTapTapRate(
    await getJson<TapTapRates>("https://api.taptapsend.com/api/fxRates", {
      "appian-version": "web/2022-05-03.0",
      "x-device-id": "web",
      "x-device-model": "web",
    }),
  );
}

async function marketRate(): Promise<number | null> {
  return parseMarketRate(await getJson<{ rates?: { PKR?: unknown } }>("https://open.er-api.com/v6/latest/EUR"));
}

/** The rates for the currencies the sites show, from the same feed. Only usable numbers are kept. */
export function parseEurRates(json: { rates?: Record<string, unknown> }): EurRates {
  const out: EurRates = {};
  for (const c of CURRENCIES) {
    const rate = usable(json.rates?.[c]);
    if (rate != null) out[c] = rate;
  }
  return out;
}

/**
 * Today's rates for a scrape. A failed request falls back to the last rates that worked (kept in the data folder), and
 * without those, prices in other currencies stay without a euro value for this run.
 */
export async function loadEurRates(): Promise<EurRates> {
  try {
    const fetched = parseEurRates(await getJson<{ rates?: Record<string, unknown> }>("https://open.er-api.com/v6/latest/EUR"));
    if (Object.keys(fetched).length > 1) {
      writeFxCache({ rates: fetched, fetchedAt: new Date().toISOString() });
      return fetched;
    }
    throw new Error("no rates in the response");
  } catch (e) {
    const cached = readFxCache();
    console.warn(`[fx] currency rates: ${(e as Error).message}${cached ? `; using those of ${cached.fetchedAt}` : "; prices in other currencies get no euro value"}`);
    return cached?.rates ?? { EUR: 1 };
  }
}

const SOURCES: { name: string; get: () => Promise<number | null> }[] = [
  { name: "Tap Tap Send", get: tapTapRate },
  { name: "market rate", get: marketRate },
];

let last: PkrRate | null = null;

/** Tap Tap Send, else the market rate, else the last rate that worked. Null only if none ever has. */
export async function getPkrRate(now = Date.now()): Promise<PkrRate | null> {
  if (last && now - Date.parse(last.fetchedAt) < REFRESH_MS) return last;
  for (const { name, get } of SOURCES) {
    try {
      const rate = await get();
      if (rate == null) throw new Error("no EUR to PKR rate in the response");
      last = { rate, source: name, fetchedAt: new Date(now).toISOString() };
      return last;
    } catch (e) {
      console.warn(`[fx] ${name}: ${(e as Error).message}`);
    }
  }
  return last;
}
