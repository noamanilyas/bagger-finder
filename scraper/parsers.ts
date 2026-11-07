/**
 * Card layouts of individual sites, for the regex parser (no AI involved). To support a new layout, add a function
 * and list it in CARD_PARSERS under the source's id. A parser returns null when a card does not fit, and the general
 * parser in extract.ts takes over.
 */
import { countryOf, expandCountryCode } from "../lib/countries";
import { findPrice, type Currency } from "../lib/currency";

export type SiteCard = {
  title: string;
  location: string | null;
  priceEur: number | null;
  /** a price in the site's own currency: extract.ts turns it into euros */
  priceAmount?: number | null;
  priceCurrency?: Currency | null;
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
 * Year, hours and the published date can each be missing; "Ask for price" stands in for a price. Other categories have their own type there.
 */
export function parseTruck1(text: string): SiteCard | null {
  const body = text.replace(/^See all photos \(\d+\)\s*/i, "").replace(/^(?:(?:NEW AD|TOP|SOLD)\s+)+/i, "");
  // The last one: a seller's own title can name the type as well ("JCB JS 145LC crawler excavator Crawler excavator 2016").
  const type = [...body.matchAll(/\b(?:Wheel excavator|Crawler excavator|Mini excavator|Excavator|Wheel loader|Grader|Road roller|Roller)\b/gi)].at(-1);
  if (!type) return null;
  const end = type.index + type[0].length;
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


// ---- National sites. Written from real cards of 2026-11-07, which tests/parsers.test.ts keeps. -----------------

const tidy = (s: string) => s.replace(/\s+/g, " ").trim();
const firstYear = (s: string | undefined) => toNumber(s?.match(/(?<!\d)((?:19|20)\d{2})(?!\d)/)?.[1]);

/** A price in the site's currency (or in euros where a site shows both): extract.ts makes euros of it. */
function priced(text: string, currency: Currency): Pick<SiteCard, "priceEur" | "priceAmount" | "priceCurrency"> {
  const p = findPrice(text, currency);
  return { priceEur: null, priceAmount: p?.amount ?? null, priceCurrency: p?.currency ?? null };
}

/** "net €50.900 (excl. VAT)" when a card shows the price with and without VAT. */
function netNote(net: number | null, currency: Currency): string | null {
  if (net == null) return null;
  return `net ${currency === "EUR" ? `€${net.toLocaleString("de-DE")}` : `${net.toLocaleString("de-DE")} ${currency}`} (excl. VAT)`;
}

const NUMBER = String.raw`\d{1,3}(?:[ .,\u00a0]\d{3})+|\d{1,6}`;

/**
 * Landwirt.com: "Gebrauchtmaschine Doosan DX57W-7 39.000 € Bj. 2019 3.378 h … Baumaschinen Mobilbagger Eisenwagen
 * Baumaschinen GmbH 2325 Himberg Baumaschinen / Doosan 15-11-2022 13:09"
 */
export function parseLandwirt(text: string): SiteCard | null {
  const head = text.match(/^(?:(Neumaschine|Gebrauchtmaschine|Vorführmaschine)\s+)?(.+?)\s+(?:Preis auf Anfrage|(?:\d{1,3}(?:\.\d{3})+|\d{3,7})\s*€)/);
  if (!head) return null;
  const year = text.match(/Bj\.\s*((?:19|20)\d{2})/);
  const hours = text.match(new RegExp(String.raw`Bj\.\s*\d{4}\s+(${NUMBER})\s*h\b`));
  const place = text.match(/(?<!\d)(\d{4,5})\s+(\p{Lu}[\p{L}.' -]*?)\s+Baumaschinen\s*\/\s*/u);
  // Four digits is Austria or Switzerland; five can be Germany, France or Italy, so the map lookup decides.
  const location = place ? `${place[1]} ${place[2].trim()}` : null;
  return {
    title: tidy(head[2]).slice(0, 140),
    location,
    ...priced(text, "EUR"),
    year: toNumber(year?.[1]),
    hours: toNumber(hours?.[1]),
    priceNote: head[1] === "Neumaschine" ? "new machine" : null,
  };
}

const ADEVINTA_DATE = String.raw`(?:Vandaag|Gisteren|Eergisteren|Aujourd'hui|Hier|Avant-hier|\d{1,2}\s\p{L}{3,5}\.?\s'?\d{2})`;
const ADEVINTA_BADGES = String.raw`(?:(?:Dagtopper|Topadvertentie|Topzoekertje|Annonce au top|Top|Uitgelicht|En vedette)\s+)*`;

/**
 * Marktplaats, 2dehands and 2ememain: "Bewaren in Mijn Favorieten Doosan DX140W-3 (bj 2015) € 42.500,00 Details Ophalen
 * of Verzenden Graafmachine <description>... Purmerend Dagtopper Vandaag"
 */
export function parseAdevinta(text: string): SiteCard | null {
  const body = text.replace(/^(?:Bewaren in Mijn Favorieten|Sauvegarder dans Mes Favoris)\s+/i, "");
  const cut = body.search(/\s(?:€\s?\d|(?:Zie omschrijving|Bieden|Op aanvraag|Gratis|Voir description|Faire une offre|Sur demande|Gratuit|Details|Détails|Ophalen|Enlèvement)\b)/);
  if (cut <= 0) return null;
  const title = tidy(body.slice(0, cut));
  const place =
    // The town follows the last "...", where the description is cut off.
    body.match(new RegExp(String.raw`^.*\.\.\.\s+(.+?)\s+${ADEVINTA_BADGES}${ADEVINTA_DATE}\s*$`, "isu")) ??
    body.match(new RegExp(String.raw`\s(\p{Lu}[\p{L}'-]+(?:[ -]\p{Lu}[\p{L}'-]+)?)\s+${ADEVINTA_BADGES}${ADEVINTA_DATE}\s*$`, "u"));
  const year = body.match(/\b(?:bj\.?|bouwjaar:?|année:?)\s*((?:19|20)\d{2})/i);
  // Not after a hyphen: "DX160-7 280 uur" is 280 hours, not 7,280.
  const hours = body.match(new RegExp(String.raw`(?<![\d.,-])(${NUMBER})\s*(?:draaiuren|uur|uren|heures|h)\b`, "i"));
  return {
    title: title.slice(0, 140),
    location: place ? tidy(place[1]).slice(0, 60) : null,
    ...priced(body.slice(cut, cut + 40), "EUR"),
    year: toNumber(year?.[1]) ?? firstYear(title),
    hours: toNumber(hours?.[1]),
    priceNote: null,
  };
}

/**
 * Bazoš.cz and .sk: "<title> - TOP - [7.11. 2026] <description> ... 1 100 000 Kč Trutnov 541 01 128 x Označit špatný inzerát …"
 * "Dohodou" (by agreement) or "V textu" (see text) stand in for a price.
 */
const bazos = (currency: Currency) => (text: string): SiteCard | null => {
  const head = text.match(/^(.+?)\s+-\s+(?:TOP\s+-\s+)?\[\d{1,2}\.\d{1,2}\.\s?\d{4}\]/);
  if (!head) return null;
  const tail = text.match(
    /(?:(\d{1,3}(?:\s\d{3})*)\s*(?:Kč|€)|Dohodou|V textu|Nabídněte|Ponúknite|Zdarma|Zadarmo|Cena dohodou|Info v texte)\s+(.+?)\s+(\d{3}\s\d{2})\s+\d+\s*x\b/,
  );
  const year = text.match(/(?:rok výroby|rok výroby|r\.\s?v\.|rv\.?|rok)\s*:?\s*((?:19|20)\d{2})/i);
  const hours = text.match(new RegExp(String.raw`(?<![\d.,])(${NUMBER})\s*(?:mth|motohodin\p{L}*|motohod\.?|hodin|hod\.?)(?![\p{L}])`, "iu"));
  const amount = toNumber(tail?.[1]);
  return {
    title: tidy(head[1]).slice(0, 140),
    // "Zahraničie" / "Zahraničí" (abroad) with a made-up postcode says nothing about where the machine is.
    location: tail && !/^zahrani/i.test(tail[2]) ? `${tail[3]} ${tail[2]}` : null,
    priceEur: null,
    priceAmount: amount,
    priceCurrency: amount != null ? (/\d\s*€/.test(tail![0]) ? "EUR" : currency) : null,
    year: toNumber(year?.[1]) ?? firstYear(head[1]),
    hours: toNumber(hours?.[1]),
    priceNote: null,
  };
};
export const parseBazosCz = bazos("CZK");
export const parseBazosSk = bazos("EUR");

/**
 * Otomoto and Autovit: "1 / 3 Doosan DX55-9C 2018 Doosan - DX55-9C Wyróżnione year 2018 Stare Miasto (Wielkopolskie) Firma
 * • Opublikowano … ad link 2018 47 080 PLN", or "… ad link 2020 61 589 EUR ( 50 900 EUR - net ) Calculeaza rata"
 */
const olxGroup = (currency: Currency) => (text: string): SiteCard | null => {
  const body = text.replace(/^\d+\s*\/\s*\d+\s+/, "");
  const cut = body.search(/\s(?:Wyróżnione|Promowane|Promovat|year\s(?:19|20)\d{2})\b/);
  if (cut <= 0) return null;
  const title = tidy(body.slice(0, cut));
  const year = body.match(/\byear\s((?:19|20)\d{2})\b/);
  const place = body.match(/\byear\s\d{4}\s+(.+?)\s+\(([^)]+)\)\s+(?:Firma|Osoba prywatna|Prywatn\p{L}*|Profesionist|Persoan\p{L}* fizic\p{L}*|Privat)/u);
  const tail = body.slice(body.lastIndexOf("ad link") + 1 || cut);
  const price = priced(tail, currency);
  const net = tail.match(new RegExp(String.raw`\(\s*(${NUMBER})\s*(?:PLN|EUR|RON|lei)\s*-\s*net\s*\)`, "i"));
  const hours = title.match(/(?<![\d.,])(\d{1,3}(?:[.\s]\d{3})+|\d{2,6})\s*(?:h|mtg|mth|ore|motogodzin\p{L}*)(?![\p{L}])/iu);
  return {
    title: title.slice(0, 140),
    location: place ? `${place[1].trim()}, ${place[2].trim()}` : null,
    ...price,
    year: toNumber(year?.[1]),
    hours: toNumber(hours?.[1]),
    priceNote: net ? netNote(toNumber(net[1]), price.priceCurrency ?? currency) : /\bnetto\b/i.test(tail) ? "excl. VAT" : null,
  };
};
export const parseOtomoto = olxGroup("PLN");
export const parseAutovit = olxGroup("RON");

/**
 * Jófogás Auto: "Doosan DW85 1500 üó 8 17,90 M Ft 2022 • 0 km Lisztes Trans Kereskedés Berettyóújfalu 8 Doosan DW85 1500 üó
 * 17 900 000 Ft 2022 • 0 km Lisztes Trans Kereskedés Berettyóújfalu"
 */
export function parseJofogas(text: string): SiteCard | null {
  const head = text.match(/^(.+?)\s+\d{1,2}\s+\d+(?:,\d+)?\s*M?\s*Ft\b/) ?? text.match(/^(.+?)\s+\d[\d ]*\s*Ft\b/);
  if (!head) return null;
  const full = findPrice(text, "HUF");
  const short = text.match(/(\d+),(\d{1,2})\s*M\s*Ft/);
  const amount = full?.amount ?? (short ? Math.round(Number(`${short[1]}.${short[2]}`) * 1_000_000) : null);
  const year = text.match(/(?<!\d)((?:19|20)\d{2})\s*•/);
  const hours = text.match(new RegExp(String.raw`(?<![\d.,])(${NUMBER})\s*(?:üó|üzemóra|üzem óra|óra)(?![\p{L}])`, "iu"));
  // Hungarian towns are one word ("Berettyóújfalu", "Hajdú-Szoboszló"); the word before is the seller's kind.
  const place = text.match(/\s(\p{Lu}[\p{L}-]+)\s*$/u);
  return {
    title: tidy(head[1]).slice(0, 140),
    location: place?.[1] ?? null,
    priceEur: null,
    priceAmount: amount,
    priceCurrency: amount != null ? "HUF" : null,
    year: toNumber(year?.[1]),
    hours: toNumber(hours?.[1]),
    priceNote: null,
  };
}

/**
 * Agroinform: "14 Caterpillar M316D gumikerekes kotró 24.180.000 Ft +ÁFA 14 éve hirdető 2026. november 7. 18:04 •
 * Forgógémes rakodó • Pest , Nagykőrös <description> Használt Gyártási év: 2013 167 LE"
 */
export function parseAgroinform(text: string): SiteCard | null {
  const body = text.replace(/^\d{1,3}\s+/, "");
  const head = body.match(/^(.+?)\s+(?:\d{1,3}(?:\.\d{3})+|\d{3,9})\s*(?:Ft|EUR|€)/);
  if (!head) return null;
  const year = body.match(/Gyártási év:\s*((?:19|20)\d{2})/);
  const hours = body.match(new RegExp(String.raw`(?<![\d.,])(${NUMBER})\s*(?:h\s+)?üzemóra`, "i"));
  // "• Pest , Nagykőrös": county, then town; "Budapest , Budapest (I. kerület)" keeps the district.
  const place = body.match(/•\s*[^•]+?\s*•\s*([\p{L} -]+?)\s*,\s*(\p{Lu}[\p{L}-]+(?:\s\([^)]*\))?)/u);
  return {
    title: tidy(head[1]).slice(0, 140),
    location: place ? `${place[2]}, ${place[1].trim()}` : null,
    ...priced(body, "HUF"),
    year: toNumber(year?.[1]) ?? firstYear(head[1]),
    hours: toNumber(hours?.[1]),
    priceNote: /\+\s*ÁFA|nettó/i.test(body.slice(head[0].length - 20, head[0].length + 20)) ? "excl. VAT" : null,
  };
}

/**
 * FINN and Blocket (Vend): "Pil til venstre Pil til høyre Bilde 1 av 22 Doosan DX140LCR-5 2020 1 585 000 kr Hell ∙ Rockmann AS
 * Forhandler ∙ 3 115 timer …", or with VAT apart: "Sany SY10U 2026 318 750 kr 255 000 kr exkl. moms Sundsvall ∙ X-maskiner AB"
 */
const vend = (currency: Currency) => (text: string): SiteCard | null => {
  const body = text.replace(/^.*?\b(?:Bilde|Bild)\s\d+\s+av\s+\d+\s+/i, "");
  const dot = body.indexOf(" ∙ ");
  if (dot <= 0) return null;
  const left = body.slice(0, dot);
  const tokens = [...left.matchAll(new RegExp(String.raw`(?<![\d.,])(?:(?:19|20)\d{2}(?=\s)|(?:${NUMBER})\s*kr(?:\s+exkl\.\s+moms|\s+eks\.\s+mva)?)`, "g"))];
  // The year and prices stand together right before the town; a title may hold a year of its own ("2008 Doosan DX 140 LC").
  let run = tokens.length;
  while (run > 0 && (run === tokens.length || /^\s*$/.test(left.slice(tokens[run - 1].index! + tokens[run - 1][0].length, tokens[run].index)))) run--;
  const group = tokens.slice(run);
  const last = group.at(-1);
  // The seller's kind can follow the town: "Gratangen Privat".
  const town = tidy(last ? left.slice(last.index! + last[0].length) : (left.match(/\S+$/)?.[0] ?? "")).replace(/\s+(?:Privat|Forhandler|Företag|Företaget)$/i, "");
  const title = tidy(group.length ? left.slice(0, group[0].index) : left.replace(/\s+\S+$/, ""));
  const prices = [...left.matchAll(new RegExp(String.raw`(?<![\d.,])(${NUMBER})\s*kr(\s+(?:exkl\.\s+moms|eks\.\s+mva))?`, "g"))];
  const gross = prices.find((p) => !p[2]) ?? prices[0];
  const net = prices.find((p) => p[2] && p !== gross);
  const hours = body.match(new RegExp(String.raw`(?<![\d.,])(${NUMBER})\s*(?:timer|timmar|tim)\b`, "i"));
  const amount = toNumber(gross?.[1]);
  return {
    title: title.slice(0, 140),
    location: town || null,
    priceEur: null,
    priceAmount: amount,
    priceCurrency: amount != null ? currency : null,
    year: firstYear(group.find((t) => /^(?:19|20)\d{2}$/.test(t[0]))?.[0]),
    hours: toNumber(hours?.[1]),
    priceNote: net ? netNote(toNumber(net[1]), currency) : gross?.[2] ? "excl. VAT" : null,
  };
};
export const parseFinn = vend("NOK");
export const parseBlocket = vend("SEK");

/** DBA's market: "153.000 kr. Gumminged Doosan DL420 med trykkabine Tølløse 5 dage Klaravik Danmark Føj til favoritter" */
export function parseDba(text: string): SiteCard | null {
  const m = text.match(
    /^(?:([\d.]+)\s*kr\.?\s+)?(.+?)\s+(\p{Lu}[\p{L}-]+(?:\s\p{Lu}[\p{L}-]+)?)\s+(?:\d+\s+(?:dage?|timer?|min\.?|uger?|måneder?)|\d{1,2}\.\s\p{L}{3}\.?|i går|i dag)(?![\p{L}])/u,
  );
  if (!m) return null;
  const amount = toNumber(m[1]);
  return {
    title: tidy(m[2]).slice(0, 140),
    location: m[3],
    priceEur: null,
    priceAmount: amount,
    priceCurrency: amount != null ? "DKK" : null,
    year: firstYear(m[2]),
    hours: null,
    priceNote: null,
  };
}

/**
 * Maskinbladet: "Doosan DL420-5 God og solid gummiged … 7300 Jelling Årgang: 2015 Timer: 10973 HK: 345.00 Pris: DKK 495.000,-
 * ekskl. moms Favorit Favorit"
 */
export function parseMaskinbladet(text: string): SiteCard | null {
  const fields = text.search(/\s\d{4}\s+\p{Lu}[\p{L} .-]*?\s+(?:Årgang|Timer|Pris):/u);
  if (fields < 0 && !/Pris:/.test(text)) return null;
  // The model name opens the card; the description starts with an ordinary capitalised word followed by small letters.
  const title = text.match(/^(.{3,80}?)(?=\s+\p{Lu}\p{Ll}+\s+\p{Ll}|\s+\d+\s*cyl\b|\s+-\s|\s+\p{Lu}{3,}\d|$)/u)?.[1] ?? text.split(/\s+/).slice(0, 6).join(" ");
  const place = text.match(/(?<!\d)(\d{4})\s+(\p{Lu}[\p{L} .-]*?)\s+(?:Årgang|Timer|HK|Pris):/u);
  const price = text.match(/Pris:\s*DKK\s*(\d{1,3}(?:\.\d{3})+|\d{3,9})/);
  const amount = toNumber(price?.[1]);
  return {
    title: tidy(title).slice(0, 140),
    location: place ? `${place[1]} ${place[2].trim()}` : null,
    priceEur: null,
    priceAmount: amount,
    priceCurrency: amount != null ? "DKK" : null,
    year: toNumber(text.match(/Årgang:\s*((?:19|20)\d{2})/)?.[1]),
    hours: toNumber(text.match(/Timer:\s*(\d[\d.]*)/)?.[1]),
    priceNote: /ekskl\.?\s*moms/i.test(text) ? "excl. VAT" : null,
  };
}

/** Nettikone: "… Video Icon 1 1 1 Doosan DX 255 LC 45 000 € (ALV väh. kelp.) 2010 13 287 h Ota yhteyttä LIIKE Kitee › Väkevä" */
export function parseNettikone(text: string): SiteCard | null {
  const price = text.match(/(?<![\d.,])(\d{1,3}(?:\s\d{3})+|\d{3,7})\s*€(?:\s*\(([^)]*)\))?/);
  const before = price ? text.slice(0, price.index) : text.split(/\sOta yhteyttä/)[0];
  // Cards open with badges, buttons and one "1" per photo.
  const title = tidy(before.replace(/^.*(?:Video Icon|Lisää vertailuun|tähän\?)\s+/s, "").replace(/^(?:\d\s+)+/, "")).slice(0, 140);
  if (!title) return null;
  const after = price ? text.slice(price.index! + price[0].length) : "";
  const place = text.match(/Ota yhteyttä\s+(?:LIIKE|YKSITYINEN|YRITYS)?\s*([\p{L} .-]+?)(?:\s*›|\s*$)/u);
  return {
    title,
    location: place ? place[1].trim() : null,
    priceEur: null,
    priceAmount: toNumber(price?.[1]),
    priceCurrency: price ? "EUR" : null,
    year: toNumber(after.match(/^\s*((?:19|20)\d{2})\b/)?.[1]) ?? firstYear(title),
    hours: toNumber(after.match(new RegExp(String.raw`(${NUMBER})\s*h\b`))?.[1]),
    // "ALV väh. kelp." means the VAT can be deducted: the seller is a business.
    priceNote: price?.[2] && /alv/i.test(price[2]) ? (/väh/i.test(price[2]) ? "VAT deductible" : tidy(price[2])) : null,
  };
}

/** Subito: "Vetrina Doosan 22.000 € Balestrate ( PA )" or "MINIESCAVATORE DOOSAN DX85R - 3 Catania ( CT )" */
export function parseSubito(text: string): SiteCard | null {
  const body = text.replace(/^(?:(?:\d{1,2}|Vetrina|In evidenza|Spedizione disponibile)\s+)+/i, "");
  const withPrice = body.match(/^(.*?)\s+(\d{1,3}(?:\.\d{3})+|\d{2,7})\s*€\s+(.+?)\s*\(\s*([A-Z]{2})\s*\)\s*$/);
  const noPrice = withPrice ? null : body.match(/^(.*?)\s*((?:\p{Lu}[\p{L}'.-]+\s?){1,3})\(\s*([A-Z]{2})\s*\)\s*$/u);
  if (!withPrice && !noPrice) return null;
  const title = tidy(withPrice ? withPrice[1] : noPrice![1]) || tidy(body).slice(0, 60);
  const town = withPrice ? `${withPrice[3].trim()}, ${withPrice[4]}` : `${noPrice![2].trim()}, ${noPrice![3]}`;
  return {
    title: title.slice(0, 140),
    location: town,
    priceEur: null,
    priceAmount: toNumber(withPrice?.[2]),
    priceCurrency: withPrice ? "EUR" : null,
    year: firstYear(title),
    hours: null,
    priceNote: null,
  };
}

/**
 * Leboncoin: "Doosan DX27Z 17 880 € 14 900 € HT Prix: 17 880 €.. 14 900 € hors taxes. Pro Vendeur professionnel. · Pelle · 2018
 * Type de matériel: "Pelle". Année: "2018" … TIPMAT Grandchamps-des-Fontaines 44119 Située à Grandchamps-des-Fontaines 44119."
 */
export function parseLeboncoin(text: string): SiteCard | null {
  const body = text.replace(/^À la une\s+Annonce à la une\.\s*/i, "");
  const cut = body.search(/\s(?:\d{1,3}(?:\s\d{3})+|\d{3,7})\s€|\sPro\s+Vendeur|\sParticulier|\s·\s|\sPrix:/);
  if (cut <= 0) return null;
  const title = tidy(body.slice(0, cut));
  const place = body.match(/Située à (.+?)\s+(\d{5})\.?\s*$/);
  const prices = [...body.slice(cut, cut + 60).matchAll(/(?<![\d.,])(\d{1,3}(?:\s\d{3})+|\d{3,7})\s€(\s*HT)?/g)];
  const gross = prices.find((p) => !p[2]);
  const net = prices.find((p) => p[2]);
  const amount = toNumber((gross ?? net)?.[1]);
  return {
    title: title.slice(0, 140),
    location: place ? `${place[2]} ${place[1]}` : null,
    priceEur: null,
    priceAmount: amount,
    priceCurrency: amount != null ? "EUR" : null,
    year: toNumber(body.match(/Année:\s*"((?:19|20)\d{2})"/)?.[1]) ?? firstYear(title),
    hours: toNumber(body.match(/Heures d'utilisation:\s*"([\d\s]+)"/)?.[1]),
    priceNote: gross && net ? netNote(toNumber(net[1]), "EUR") : net ? "excl. VAT" : null,
  };
}

/** Autotrader Plant: "Volvo ECR88D 2022 POA +VAT 2022 Volvo ECR88D Tracked Excavator Sold by … - Located in MALTBY-GBR" */
export function parseAutotrader(text: string): SiteCard | null {
  const cut = text.search(/\s(?:£\s?\d|POA\b)/);
  if (cut <= 0) return null;
  const title = tidy(text.slice(0, cut));
  const rest = text.slice(cut);
  const place = rest.match(/Located in ([A-Za-z][A-Za-z .'-]+?)(?:-[A-Z]{3})?(?:\s|$)/);
  return {
    title: title.slice(0, 140),
    location: place ? `${place[1].replace(/\b([A-Z])([A-Z]+)\b/g, (_, a, b) => a + b.toLowerCase())}, United Kingdom` : null,
    ...priced(rest.slice(0, 30), "GBP"),
    year: toNumber(rest.match(/^\s*(?:£\s?[\d,]+|POA)\s*(?:\+VAT)?\s*((?:19|20)\d{2})\b/)?.[1]) ?? firstYear(title),
    hours: toNumber(rest.match(/(\d{1,3}(?:,\d{3})+|\d{2,6})\s*(?:hours|hrs)\b/i)?.[1]),
    priceNote: /^\s*(?:£\s?[\d,]+|POA)\s*\+VAT/.test(rest) ? "excl. VAT" : null,
  };
}

export const CARD_PARSERS: Record<string, (text: string) => SiteCard | null> = {
  mascus: parseMascus,
  "europe-construction-equipment": parseEce,
  truck1: parseTruck1,
  landwirt: parseLandwirt,
  marktplaats: parseAdevinta,
  "2dehands": parseAdevinta,
  "2ememain": parseAdevinta,
  "bazos-cz": parseBazosCz,
  "bazos-sk": parseBazosSk,
  otomoto: parseOtomoto,
  autovit: parseAutovit,
  jofogas: parseJofogas,
  agroinform: parseAgroinform,
  finn: parseFinn,
  dba: parseDba,
  blocket: parseBlocket,
  maskinbladet: parseMaskinbladet,
  nettikone: parseNettikone,
  subito: parseSubito,
  leboncoin: parseLeboncoin,
  autotrader: parseAutotrader,
};
