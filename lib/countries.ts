/**
 * Every country a listing can name, in one table. To add a spelling, add it to the country's names.
 * Names follow the same rules as lib/languages: whole words, "*" for any letters, accents optional.
 */
import { termSource } from "./languages";

export type Region = "europe" | "excluded";

export type Country = {
  /** ISO 3166 code, as some sites print it ("Siegen, DE") */
  code: string;
  /** English name, used to look the place up on the map */
  name: string;
  region: Region;
  names: string[];
};

const europe = (code: string, name: string, ...names: string[]): Country => ({ code, name, region: "europe", names: [name, ...names] });
const excluded = (code: string, name: string, ...names: string[]): Country => ({ code, name, region: "excluded", names: [name, ...names] });

export const COUNTRIES: Country[] = [
  europe("DE", "Germany", "*deutschland", "allemagne", "niemcy", "duitsland"),
  europe("PL", "Poland", "polen", "polska", "pologne"),
  europe("FR", "France", "frankreich", "francja", "frankrijk"),
  europe("NL", "Netherlands", "niederlande", "nederland", "holland", "holandia", "pays-bas"),
  europe("BE", "Belgium", "belgien", "belgique", "belgië", "belgia"),
  europe("LU", "Luxembourg", "luxemburg"),
  europe("AT", "Austria", "österreich*", "oostenrijk", "autriche"),
  europe("CH", "Switzerland", "schweiz", "suisse", "svizzera", "zwitserland", "szwajcaria"),
  europe("IT", "Italy", "italien", "italia", "italie", "włochy"),
  europe("ES", "Spain", "spanien", "españa", "espagne", "hiszpania", "spanje"),
  europe("PT", "Portugal"),
  europe("CZ", "Czech Republic", "tschechi*", "czechia", "česko", "česká republika", "czechy", "république tchèque"),
  europe("SK", "Slovakia", "slowakei", "slovensko", "słowacja"),
  europe("HU", "Hungary", "ungarn", "magyarország", "węgry", "hongrie"),
  europe("RO", "Romania", "rumänien", "românia", "rumunia", "roumanie", "roemenië"),
  europe("BG", "Bulgaria", "bulgarien"),
  europe("SI", "Slovenia", "slowenien", "slovenija"),
  europe("HR", "Croatia", "kroatien", "hrvatska"),
  europe("RS", "Serbia", "serbien", "srbija"),
  europe("BA", "Bosnia and Herzegovina", "bosnien", "bosnia*"),
  europe("AL", "Albania", "albanien"),
  europe("MK", "North Macedonia", "mazedonien", "macedonia"),
  europe("ME", "Montenegro"),
  europe("XK", "Kosovo"),
  europe("GR", "Greece", "griechenland", "grecja", "grèce"),
  europe("LT", "Lithuania", "litauen", "lietuva", "litwa"),
  europe("LV", "Latvia", "lettland", "latvija", "łotwa"),
  europe("EE", "Estonia", "estland", "eesti"),
  europe("FI", "Finland", "finnland", "suomi", "finlandia"),
  europe("SE", "Sweden", "schweden", "sverige", "szwecja", "suède"),
  europe("NO", "Norway", "norwegen", "norge", "norwegia", "norvège"),
  europe("DK", "Denmark", "dänemark", "danmark", "dania", "danemark"),
  europe("GB", "United Kingdom", "großbritannien", "vereinigtes königreich", "great britain", "england", "scotland", "wales", "northern ireland", "uk"),
  europe("IE", "Ireland", "irland", "éire"),
  europe("IS", "Iceland", "island"),
  europe("MT", "Malta"),
  europe("CY", "Cyprus", "zypern"),
  europe("UA", "Ukraine", "ukraina"),
  europe("MD", "Moldova", "moldau"),

  // Outside Europe, plus Turkey, Russia and Belarus (the owner's choice). The ones inside the map's Europe box
  // matter most, because inEurope() cannot catch them.
  excluded("TR", "Turkey", "türkei", "türkiye", "turcja"),
  excluded("RU", "Russia", "russland", "rosja"),
  excluded("BY", "Belarus", "weißrussland", "białoruś"),
  excluded("CN", "China", "chiny"),
  excluded("HK", "Hong Kong"),
  excluded("IN", "India", "indien"),
  excluded("NP", "Nepal"),
  excluded("AE", "United Arab Emirates", "*emirate", "uae"),
  excluded("US", "United States", "usa", "vereinigte staaten"),
  excluded("CA", "Canada", "kanada"),
  excluded("JP", "Japan"),
  excluded("KR", "South Korea", "*korea"),
  excluded("KZ", "Kazakhstan", "kasachstan"),
  excluded("UZ", "Uzbekistan", "usbekistan"),
  excluded("GE", "Georgia", "georgien"),
  excluded("AM", "Armenia", "armenien"),
  excluded("AZ", "Azerbaijan", "aserbaidschan"),
  excluded("IL", "Israel"),
  excluded("SA", "Saudi Arabia", "saudi*"),
  excluded("QA", "Qatar", "katar"),
  excluded("IR", "Iran"),
  excluded("IQ", "Iraq", "irak"),
  excluded("SY", "Syria", "syrien"),
  excluded("LB", "Lebanon", "libanon"),
  excluded("JO", "Jordan", "jordanien"),
  excluded("EG", "Egypt", "ägypten"),
  excluded("MA", "Morocco", "marokko"),
  excluded("DZ", "Algeria", "algerien"),
  excluded("TN", "Tunisia", "tunesien"),
  excluded("ZA", "South Africa", "südafrika"),
  excluded("BR", "Brazil", "brasilien"),
  excluded("AU", "Australia", "australien"),
];

const BY_CODE = new Map(COUNTRIES.map((c) => [c.code, c]));
const PATTERNS = COUNTRIES.map((country) => ({
  country,
  pattern: new RegExp(country.names.map((n) => termSource(n)).join("|"), "giu"),
}));

/**
 * The country a place names. When it names several, the last wins: "Polen" in "Neu Polen, Deutschland" is a town.
 * Two-letter codes are not read here: "München, BY" is Bavaria, not Belarus. See expandCountryCode.
 */
export function countryOf(place: string | null | undefined): Country | null {
  if (!place) return null;
  let best: Country | null = null;
  let bestAt = -1;
  for (const { country, pattern } of PATTERNS) {
    for (const m of place.matchAll(pattern)) {
      if (m.index >= bestAt) {
        best = country;
        bestAt = m.index;
      }
    }
  }
  return best;
}

export const isExcludedPlace = (place: string | null | undefined) => countryOf(place)?.region === "excluded";

/**
 * For sites known to end a place with a country code: "Siegen, DE" becomes "Siegen, Germany", "-, DE" becomes
 * "Germany". Only call this for those sites (Source.countryCodes): elsewhere "BY" and "BE" are German states.
 */
export function expandCountryCode(place: string | null): string | null {
  if (!place) return place;
  const code = place.match(/(?:^|,\s*)([A-Z]{2})\s*$/);
  const country = code && BY_CODE.get(code[1]);
  if (!country) return place;
  // Some sellers type the code as well: "Vilnius, LT, LT".
  const town = place
    .slice(0, code.index)
    .replace(/^[\s,-]+|[\s,-]+$/g, "")
    .replace(new RegExp(`,\\s*${code[1]}$`), "");
  return town ? `${town}, ${country.name}` : country.name;
}

/** Catches countries missing from the table, once a listing has coordinates. */
export const inEurope = (c: { lat: number; lng: number }) => c.lat >= 34 && c.lat <= 72 && c.lng >= -25 && c.lng <= 45;
