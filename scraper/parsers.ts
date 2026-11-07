/**
 * Card layouts of individual sites, for the regex parser (no AI involved). To support a new layout, add a function
 * and list it in CARD_PARSERS under the source's id. A parser returns null when a card does not fit, and the general
 * parser in extract.ts takes over.
 */
import { countryOf, expandCountryCode } from "../lib/countries";

export type SiteCard = {
  title: string;
  location: string | null;
  priceEur: number | null;
  year: number | null;
  hours: number | null;
  priceNote: string | null;
};

/** "99,000", "45.800", "45 800": whichever separator a site uses. */
export const toNumber = (s: string | undefined): number | null => {
  if (!s) return null;
  const n = parseInt(s.replace(/[.,'\s]/g, ""), 10);
  return Number.isNaN(n) ? null : n;
};

const AMOUNT = String.raw`\d{1,3}(?:[.,\s]\d{3})+|\d{3,7}`;

/**
 * Mascus: "10 Top-Inserat Volvo EWR 170 E Schultes GmbH Mobilbagger • 2022 • 3950h • Siegen, DE • Schultes GmbH 124.000 EUR Favoriten Schultes GmbH"
 * Year, hours and place can each be missing, so they are told apart by what they look like.
 */
export function parseMascus(text: string): SiteCard | null {
  const parts = text.split("•").map((p) => p.trim());
  if (parts.length < 3) return null;

  // The card opens with photo and video counts ("24 1"), sometimes a promotion label.
  const head = parts[0].replace(/^(?:\d{1,3}\s+)+/, "").replace(/^Top-Inserat\s+/i, "");
  const middle = parts.slice(1, -1);
  const tail = parts[parts.length - 1];

  const price = tail.match(new RegExp(String.raw`(?:^|\s)(${AMOUNT})\s*EUR\b`));
  const other = price ? null : tail.match(new RegExp(String.raw`(?:^|\s)(${AMOUNT})\s*([A-Z]{3})\b`));
  // The seller's name opens the last part and also ends the head, between the title and the machine type.
  const sellerEnd = tail.search(new RegExp(String.raw`(?:^|\s)(?:${AMOUNT})\s*[A-Z]{3}\b|\s*Preis auf Anfrage|\s*Favoriten`));
  const seller = sellerEnd > 0 ? tail.slice(0, sellerEnd).trim() : "";
  const sellerAt = seller ? head.lastIndexOf(seller) : -1;
  const title = (sellerAt > 0 ? head.slice(0, sellerAt) : head).trim();

  const year = middle.find((p) => /^(?:19|20)\d{2}$/.test(p));
  const hours = middle.find((p) => /^[\d.,\s]+h$/i.test(p));
  // A hidden town shows as "On request, BE" or "-, DE": only the country is known.
  const place = middle.find((p) => /(?:^|,\s*)[A-Z]{2}$/.test(p))?.replace(/^(?:On request|Auf Anfrage)\s*,\s*/i, "");

  return {
    title: title.slice(0, 140),
    location: expandCountryCode(place ?? null),
    priceEur: toNumber(price?.[1]),
    year: toNumber(year),
    hours: toNumber(hours?.replace(/h$/i, "")),
    priceNote: other ? `${other[1]} ${other[2]}` : null,
  };
}

/**
 * Europe-Construction-Equipment: "47 New Doosan wheel excavator DX165W-5 99,000 EUR Ex. VAT 2019 6076 hours 17.7 tonnes SELLER NAME FRANCE - Yvelines Contact More details ..."
 * Some cards run on into the machine's details, which is why only the part up to "Contact" is read.
 */
export function parseEce(text: string): SiteCard | null {
  const card = text.split(/\sContact\b/)[0];
  const body = card.replace(/^\d{1,3}\s+/, "").replace(/^New\s+/, "");
  const price = body.match(new RegExp(String.raw`\s(${AMOUNT})\s*EUR\b(\s*Ex\.?\s*VAT)?`, "i"));
  const year = body.match(/\s((?:19|20)\d{2})(?=\s)/);
  const cut = price?.index ?? year?.index;
  if (cut == null) return null;

  const after = price ? body.slice(price.index! + price[0].length) : body.slice(cut);
  const yearAfter = after.match(/(?:^|\s)((?:19|20)\d{2})(?=\s)/);
  // The lookbehind keeps a year in front out of it: "2019 6076 hours" is 6076.
  const hours = after.match(/(?<![\d.,])(\d{1,3}(?:[.,\s]\d{3})+|\d{1,6})\s*hours\b/i);

  // "... SELLER NAME FRANCE - Yvelines" or "... Seller Ltd China - 河南省". The last country named before " - " is the place.
  const dash = card.lastIndexOf(" - ");
  const country = countryOf(dash >= 0 ? card.slice(0, dash) : card.slice(-40));
  const region = dash >= 0 ? card.slice(dash + 3).trim() : "";

  return {
    title: body.slice(0, cut).replace(/\s*Price on request\s*$/i, "").trim().slice(0, 140),
    location: country ? (region ? `${region}, ${country.name}` : country.name) : null,
    priceEur: toNumber(price?.[1]),
    year: toNumber(yearAfter?.[1]),
    hours: toNumber(hours?.[1]),
    priceNote: price?.[2] ? "excl. VAT" : null,
  };
}

/**
 * Truck1: "See all photos (5) NEW AD TOP Hyundai HW170ACR Wheel excavator 2023 460 h Germany, Zusmarshausen Published: 17hr 139 000EUR Price excl. VAT ≈ 156 067 USD Seller GmbH 7 Contact the seller"
 * Year, hours and the published date can each be missing; "Ask for price" stands in for a price.
 */
export function parseTruck1(text: string): SiteCard | null {
  const body = text.replace(/^See all photos \(\d+\)\s*/i, "").replace(/^(?:(?:NEW AD|TOP|SOLD)\s+)+/i, "");
  const type = body.match(/\bWheel excavator\b/i);
  if (!type) return null;
  const end = type.index! + type[0].length;
  const after = body.slice(end);

  const year = after.match(/^\s*((?:19|20)\d{2})\b/);
  const hours = after.match(/(?<![\d.,])(\d{1,3}(?:\s\d{3})+|\d{1,6})\s*h(?![\p{L}])/iu);
  const price = after.match(/(?<![\d.,])(\d{1,3}(?:\s\d{3})+|\d{3,7})\s*EUR\b(\s*Price excl\. VAT)?/);
  // "Germany, Zusmarshausen": the place runs up to the first word that is no longer part of it.
  const place = after.match(/(?:^|\s)(\p{Lu}[\p{L}.'-]*(?: \p{Lu}[\p{L}.'-]*)*),\s*(.+?)\s+(?:Published:|Reference number|Ask for price|\d[\d\s]*\s*EUR)/u);
  const country = countryOf(place?.[1]);

  return {
    title: body.slice(0, end).trim().slice(0, 140),
    location: place ? (country ? `${place[2].trim()}, ${country.name}` : `${place[2].trim()}, ${place[1]}`) : null,
    priceEur: toNumber(price?.[1]),
    year: toNumber(year?.[1]),
    hours: toNumber(hours?.[1]),
    priceNote: price?.[2] ? "excl. VAT" : null,
  };
}

export const CARD_PARSERS: Record<string, (text: string) => SiteCard | null> = {
  mascus: parseMascus,
  "europe-construction-equipment": parseEce,
  truck1: parseTruck1,
};
