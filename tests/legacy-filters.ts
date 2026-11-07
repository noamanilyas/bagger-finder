/**
 * FROZEN copy of the German-only filters as they were before lib/languages existed.
 * Do not edit: tests compare the current filters against this, so nothing that used to pass gets lost.
 */
import { WANTED, type WantedModel } from "../lib/config";

const HARD_EXCLUDE =
  /reifen|räder\b|felge|gummiketten?|gummipads?|laufrolle|ersatzteil|zahnrad|kühler|hydraulikpumpe|anhänger|vermiet|mieten|miete\b|mietpreis|tagesmiete|mietmaschine|\/\s*tag\b|pro tag|zu miete|mietbagger|gesuch|suche\s|radlader|gabelstapler|stapler|generator|cnc|bearbeitungszentrum|drehmaschine|fräsmaschine|dreh- und fräs|landmaschine/i;
const SOFT_EXCLUDE = /motor\b|motoren|kabine|schlüssel|scheibe/i;
const UNWANTED_SIZE = /(?:robex|hx|hw|dx|w|(?<![a-z])r)\s*-?\s*(?:150|170)(?!\d)|(?<!\d)(?:150|170)\s*-?\s*w(?![a-z])/i;
const PART_AD = /^\W*(?:hydraulisch\w*\s+)?(?:fahrantrieb|endantrieb|fahrmotor|schwenkmotor|schnellwechsler|(?:tief|grab\w*|sieb)?löffel|planierschild|bolzen|zylinder|lanturi)/i;

export function legacyMatchModel(text: string): WantedModel | null {
  if (PART_AD.test(text)) return null;
  if (HARD_EXCLUDE.test(text)) return null;
  if (UNWANTED_SIZE.test(text)) return null;
  if (SOFT_EXCLUDE.test(text) && !/bagger|excavator/i.test(text)) return null;
  for (const m of WANTED) {
    if (m.make.test(text) && m.number.test(text) && (!m.needsBagger || /bagger|excavator/i.test(text))) return m;
  }
  return null;
}

export function legacyIsWheeled(text: string): boolean {
  return /mobilbagger|radbagger|mobile excavator|wheel(?:ed)? excavator|(?:dx|robex|hx|r|b|sv)\s*-?\s*\d{2,3}\s*-?\s*w(?![a-z])/i.test(text);
}

export const LEGACY_EUROPE =
  /deutschland|germany|polen|poland|frankreich|france|niederlande|netherlands|belgien|luxemburg|österreich|schweiz|italien|spanien|portugal|tschechi|slowakei|ungarn|rumänien|bulgarien|slowenien|kroatien|serbien|bosnien|albanien|mazedonien|montenegro|kosovo|griechenland|litauen|lithuania|lettland|estland|finnland|schweden|norwegen|dänemark|großbritannien|vereinigtes königreich|irland|island|malta|zypern|ukraine|moldau/i;

export const LEGACY_NON_EUROPE =
  /china|indien|emirate|\busa\b|vereinigte staaten|kanada|japan|korea|türkei|russland|belarus|weißrussland|kasachstan|usbekistan|georgien|armenien|aserbaidschan|israel|saudi|katar|iran|irak|ägypten|marokko|südafrika|brasilien|australien/i;
