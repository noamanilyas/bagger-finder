import type { Language } from "./types";

/** The original filters, unchanged: tests/legacy-filters.ts holds the frozen copy they are compared with. */
export const de: Language = {
  code: "de",
  name: "Deutsch",
  exactAccents: true,
  excavator: [/bagger/],
  wheeled: [/mobilbagger|radbagger/],
  tracked: [/kettenbagger|raupenbagger/],
  notForSale: [
    // tyres and parts
    /reifen|räder\b|felge|gummiketten?|gummipads?|laufrolle|ersatzteil|zahnrad|kühler|hydraulikpumpe|anhänger/,
    // rental
    /vermiet|mieten|miete\b|mietpreis|tagesmiete|mietmaschine|\/\s*tag\b|pro tag|zu miete|mietbagger/,
    // wanted ads
    /gesuch|suche\s/,
    // other machines
    /radlader|gabelstapler|stapler|generator|cnc|bearbeitungszentrum|drehmaschine|fräsmaschine|dreh- und fräs|landmaschine/,
  ],
  softExclude: [/motor\b|motoren|kabine|schlüssel|scheibe/],
  partAtStart: [/(?:hydraulisch\w*\s+)?(?:fahrantrieb|endantrieb|fahrmotor|schwenkmotor|schnellwechsler|(?:tief|grab\w*|sieb)?löffel|planierschild|bolzen|zylinder|lanturi)/],
  labels: { year: ["baujahr", "bj.", "ez"], hours: ["betriebsstunden", "bh", "std", "m/std"] },
  searchWords: ["mobilbagger", "radbagger"],
  acceptCookies: ["Alle akzeptieren", "Akzeptieren", "Zustimmen"],
  examples: {
    wheeled: ["Hyundai R140W-7 Mobilbagger", "Doosan DX140W Radbagger Baujahr 2012"],
    keep: ["Yanmar ViO55 Minibagger", "Doosan DX55 Bagger mit Schnellwechsler"],
    drop: ["Doosan DX140 Bagger zu mieten", "Reifen für Hyundai R140W Bagger", "Schnellwechsler für Hyundai R140 Bagger"],
  },
};
