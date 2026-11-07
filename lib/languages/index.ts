/**
 * Every language the filters understand, one file each. To add a language:
 *   1. copy a file in this folder and fill it in, including its `examples`
 *   2. add it to LANGUAGES below (and its code to LangCode in types.ts)
 *   3. run `npm test`: it checks the examples and looks for clashes with the other languages
 *
 * Two rules keep this safe as it grows:
 *   - Positive words (excavator, wheeled) work on every source. They can only help an ad that already names
 *     a wanted make and model number.
 *   - Exclusions work only on sources that declare the language. "location" is rental in French and a field
 *     label in English, and "banden" is tyres in Dutch but part of "bandenkraan".
 */
import { cs } from "./cs";
import { da } from "./da";
import { de } from "./de";
import { en } from "./en";
import { fr } from "./fr";
import { hu } from "./hu";
import { nl } from "./nl";
import { no } from "./no";
import { pl } from "./pl";
import { ro } from "./ro";
import { sk } from "./sk";
import type { LangCode, Language, Term } from "./types";

export type { LangCode, Language, Term } from "./types";

export const LANGUAGES: Record<LangCode, Language> = { de, en, pl, nl, fr, cs, sk, hu, ro, no, da };

/** What a source is assumed to be written in when it does not say. */
export const DEFAULT_LANGUAGES: LangCode[] = ["de"];

const ANY_LETTER = String.raw`\p{L}`;
/** Letters that do not break down into a base letter plus an accent. */
const NO_ACCENT: Record<string, string> = { ł: "l", ø: "o", æ: "ae", œ: "oe", ß: "ss", đ: "d" };

const escapeChar = (c: string) => c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
const withoutAccent = (c: string) => NO_ACCENT[c] ?? c.normalize("NFD").replace(/\p{M}/gu, "");

/** Regex source for one term. Exported so other word lists (countries) follow the same rules. */
export function termSource(term: Term, exactAccents = false): string {
  if (term instanceof RegExp) return term.source;
  let out = "";
  for (const c of term.toLowerCase()) {
    if (c === "*") out += `${ANY_LETTER}*`;
    else if (/\s/.test(c)) out += String.raw`[\s-]+`;
    else if (c === "-") out += String.raw`[\s-]*`;
    else {
      const plain = exactAccents ? c : withoutAccent(c);
      out += plain === c ? escapeChar(c) : `(?:${escapeChar(c)}|${escapeChar(plain)})`;
    }
  }
  return `(?<!${ANY_LETTER})${out}(?!${ANY_LETTER})`;
}

/** Regex that never matches: a language may have nothing in a category. */
const NOTHING = "(?!)";
const joined = (sources: string[]) => (sources.length > 0 ? sources.join("|") : NOTHING);

function compile(languages: Language[], pick: (l: Language) => Term[] | undefined): string {
  return joined(languages.flatMap((l) => (pick(l) ?? []).map((t) => termSource(t, l.exactAccents))));
}

const ALL = Object.values(LANGUAGES);

/** The ad calls itself an excavator, in any known language. Wheeled words count too: "bandenkraan" says both. */
export const EXCAVATOR_WORD = new RegExp(compile(ALL, (l) => [...l.excavator, ...l.wheeled]), "iu");
/** The ad calls itself wheeled, in any known language. */
export const WHEELED_WORD = new RegExp(compile(ALL, (l) => l.wheeled), "iu");
/** The ad calls itself a crawler, in any known language. */
export const TRACKED_WORD = new RegExp(compile(ALL, (l) => l.tracked), "iu");

export type Exclusions = {
  weakExcavator: RegExp;
  notForSale: RegExp;
  softExclude: RegExp;
  partAtStart: RegExp;
};

const exclusionsCache = new Map<string, Exclusions>();

/** The exclusions for a source's languages. */
export function exclusionsFor(codes: LangCode[]): Exclusions {
  const key = [...codes].sort().join(",");
  let found = exclusionsCache.get(key);
  if (!found) {
    const languages = codes.map((c) => LANGUAGES[c]);
    found = {
      weakExcavator: new RegExp(compile(languages, (l) => l.weakExcavator), "iu"),
      notForSale: new RegExp(compile(languages, (l) => l.notForSale), "iu"),
      softExclude: new RegExp(compile(languages, (l) => l.softExclude), "iu"),
      partAtStart: new RegExp(String.raw`^\W*(?:${compile(languages, (l) => l.partAtStart)})`, "iu"),
    };
    exclusionsCache.set(key, found);
  }
  return found;
}

const NUMBER = String.raw`(\d{1,3}(?:[.,\s]\d{3})+|\d{2,6})`;
const YEAR = String.raw`((?:19|20)\d{2})`;

export type FieldPatterns = { year: RegExp; hours: RegExp };

const fieldCache = new Map<string, FieldPatterns>();

/** "Rok produkcji: 2012", "6 076 mth", "Betriebsstunden 6076": labelled values in a source's languages. */
export function fieldsFor(codes: LangCode[]): FieldPatterns {
  const key = [...codes].sort().join(",");
  let found = fieldCache.get(key);
  if (!found) {
    const languages = codes.map((c) => LANGUAGES[c]);
    const year = compile(languages, (l) => l.labels.year);
    const hours = compile(languages, (l) => l.labels.hours);
    found = {
      year: new RegExp(String.raw`(?:${year})\s*:?\s*${YEAR}`, "iu"),
      hours: new RegExp(String.raw`(?:${hours})\s*:?\s*(?:ca\.\s*)?${NUMBER}|(?<![\d.,])${NUMBER}\s*(?:${hours})`, "iu"),
    };
    fieldCache.set(key, found);
  }
  return found;
}

/** Cookie banner buttons to try for a source; English is common on every site. */
export function cookieLabels(codes: LangCode[]): string[] {
  return [...new Set([...codes.flatMap((c) => LANGUAGES[c].acceptCookies), "Accept all"])];
}
