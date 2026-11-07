/**
 * Prices in other currencies. Sites show their own currency; the app compares in euros, so the original is kept and the
 * euro value is worked out from the rate of the day. A price whose rate is unknown stays without a euro value: it is
 * never guessed.
 */

export const CURRENCIES = ["EUR", "PLN", "CZK", "HUF", "RON", "NOK", "DKK", "SEK", "GBP", "CHF"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const isCurrency = (v: unknown): v is Currency => typeof v === "string" && (CURRENCIES as readonly string[]).includes(v);

/** Units of each currency for one euro, as open.er-api.com gives them. */
export type EurRates = Partial<Record<Currency, number>>;

let rates: EurRates = { EUR: 1 };

/** Set once at the start of a scrape (see lib/fx.ts), or by tests. */
export function setEurRates(next: EurRates) {
  rates = { ...next, EUR: 1 };
}

export const eurRates = (): EurRates => rates;

/** Whole euros, or null when the rate is unknown. */
export function toEur(amount: number | null, currency: Currency | null): number | null {
  if (amount == null) return null;
  if (currency == null || currency === "EUR") return amount;
  const rate = rates[currency];
  return rate && rate > 0 ? Math.round(amount / rate) : null;
}

/** How a site writes each currency. "kr" alone is ambiguous, so it only counts on a site whose currency is known. */
const SIGNS: Record<Currency, string> = {
  EUR: String.raw`€|EUR\b|Euro\b`,
  PLN: String.raw`zł|zl\b|PLN\b`,
  CZK: String.raw`Kč|Kc\b|CZK\b|,-`,
  HUF: String.raw`Ft\b|HUF\b`,
  RON: String.raw`lei\b|RON\b`,
  NOK: String.raw`kr\b|NOK\b|,-`,
  DKK: String.raw`kr\b|DKK\b|,-`,
  SEK: String.raw`kr\b|SEK\b|:-`,
  GBP: String.raw`£|GBP\b`,
  CHF: String.raw`CHF\b|Fr\.`,
};

/** Signs that can stand before the amount ("€ 45.800", "£22,750", "DKK 495.000"). "Ft", "Kč", "kr" and "zł" only follow it. */
const PREFIXES: Record<Currency, string> = {
  EUR: String.raw`€|EUR\b`,
  PLN: String.raw`PLN\b`,
  CZK: String.raw`CZK\b`,
  HUF: String.raw`HUF\b`,
  RON: String.raw`RON\b`,
  NOK: String.raw`NOK\b`,
  DKK: String.raw`DKK\b`,
  SEK: String.raw`SEK\b`,
  GBP: String.raw`£|GBP\b`,
  CHF: String.raw`CHF\b`,
};

/** "1 590 000", "11.100.000", "28,500", "45 800,00": thousands with any separator, cents dropped. */
const AMOUNT = String.raw`\d{1,3}(?:[ .,  ]\d{3})+(?:[.,]\d{2})?(?!\d)|\d{3,9}(?:[.,]\d{2})?(?!\d)`;

const toWhole = (s: string): number | null => {
  const noCents = s.replace(/[.,]\d{2}$/, "");
  const n = parseInt(noCents.replace(/[ .,  ]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
};

/**
 * The first price on a card in the site's currency, or in euros, which some sites show as well. Returns the currency it
 * found, so a Slovak "23 900 €" on a Czech site is not read as crowns.
 */
export function findPrice(text: string, siteCurrency: Currency): { amount: number; currency: Currency } | null {
  const tries: Currency[] = siteCurrency === "EUR" ? ["EUR"] : [siteCurrency, "EUR"];
  let best: { at: number; amount: number; currency: Currency } | null = null;
  for (const currency of tries) {
    const after = new RegExp(String.raw`(?<![\d.,])(${AMOUNT})\s*(?:${SIGNS[currency]})`, "iu");
    const before = new RegExp(String.raw`(?:${PREFIXES[currency]})\s*(${AMOUNT})`, "iu");
    for (const re of [after, before]) {
      const m = text.match(re);
      const amount = m ? toWhole(m[1]) : null;
      // Prices below 100 are deposits, monthly rates or parts, never a machine.
      if (m && amount != null && amount >= 100 && (!best || m.index! < best.at)) best = { at: m.index!, amount, currency };
    }
  }
  return best && { amount: best.amount, currency: best.currency };
}

/** The site's own price of a listing, when it is not in euros: "52.000 PLN". */
export function originalPrice(l: { priceAmount?: number | null; priceCurrency?: Currency | null }): string | null {
  return l.priceCurrency && l.priceAmount != null ? formatAmount(l.priceAmount, l.priceCurrency) : null;
}

/** "52.000 PLN" for showing the original next to the euro value. */
export function formatAmount(amount: number, currency: Currency): string {
  return `${amount.toLocaleString("de-DE")} ${currency}`;
}
