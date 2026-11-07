export type LangCode = "de" | "en" | "pl" | "nl" | "fr" | "cs" | "sk" | "hu" | "ro" | "no" | "da";

/**
 * One word or phrase. A string matches as whole words, in any case:
 *   "wynajem"          the word itself
 *   "kopark*"          "*" stands for any letters: koparka, koparki
 *   "kopark* kołow*"   a space also accepts a hyphen: koparka kołowa, koparka-kołowa
 * A RegExp is used as it is, for anything these rules cannot express (the "i" and "u" flags are always on).
 */
export type Term = string | RegExp;

export type Language = {
  code: LangCode;
  name: string;
  /**
   * Accept words typed without accents ("kolowa" for "kołowa"). On by default. German turns it off: its terms
   * are substrings, so "räder" written loosely as "rader" would also match "Trader" and "Grader".
   */
  exactAccents?: boolean;

  // ---- active on every source: these only help an ad that already matched a make and a model number
  /** the general word for an excavator */
  excavator: Term[];
  /** words that say the excavator is wheeled */
  wheeled: Term[];
  /** words that say it runs on tracks: when an ad's title says so, a "wheeled" category label elsewhere is wrong */
  tracked: Term[];

  // ---- active only on sources that declare this language: one language's exclusion is another's real machine
  /** an excavator word too ordinary to trust elsewhere: French "pelle" is leather in Italian and a name in Sweden */
  weakExcavator?: Term[];
  /** anywhere in the ad: not a machine for sale (rental, wanted ads, other machine types) */
  notForSale: Term[];
  /** anywhere in the ad, unless the ad also calls itself an excavator (engines, cabs) */
  softExclude?: Term[];
  /** only when the ad opens with it: real machines often list "new tyres" or "with bucket" further on */
  partAtStart: Term[];

  // ---- field labels for the regex parser, used only on sources that declare this language
  labels: { year: Term[]; hours: Term[] };

  /** what to search for on a site in this language, for building source URLs */
  searchWords: string[];
  /** cookie banner buttons for the browser phase */
  acceptCookies: string[];

  /** Checked by tests/languages.test.ts, so a new language proves itself. Each ad names a wanted model. */
  examples: {
    /** must be accepted, and must be recognised as wheeled */
    wheeled: string[];
    /** must be accepted (whether wheeled or not) */
    keep?: string[];
    /** must be rejected */
    drop: string[];
  };
};
