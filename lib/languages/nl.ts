import type { Language } from "./types";

export const nl: Language = {
  code: "nl",
  name: "Nederlands",
  // Not plain "kraan" (also a crane or a tap), and "mobiele kraan" gave noisy results in research.
  excavator: ["*graafmachine*", "*graver", "*gravers", "bandenkraan", "banden kraan", "rupskraan", "minikraan", "wielkraan"],
  wheeled: ["bandenkraan", "banden kraan", "wielkraan", "mobiele graafmachine*", "wielgraafmachine*", "mobiele graver*"],
  tracked: ["rupskraan", "rupsgraafmachine*", "rupsgraver*"],
  grader: ["*grader*"],
  loader: ["wiellader*"],
  roller: ["*wals", "*walsen"],
  // Not "verhuur": dealers are called "XYZ Verkoop en Verhuur".
  // Parts sold with a machine's name in them ("ruilpomp tbv Hyundai Robex 140W-9"), and wanted ads.
  notForSale: ["te huur", "huren", "per dag", "per week", "gevraagd", "gezocht", "op zoek naar", "opzoek naar", "*heftruck*", "ruilpomp", "ruilunit", "hoofdpomp", "versnellingsbak"],
  // "banden" means tyres, but "bandenkraan" is exactly the machine we want.
  partAtStart: [/banden?(?!\p{L})(?![\s-]*kraan)/u, "verhuur", "onderdelen", "velg*", "rupsen", "graafbak*", "bak", "motor", "snelwissel*", "hydrauliekpomp*", "cilinder*"],
  labels: { year: ["bouwjaar", "bj"], hours: ["draaiuren", "bedrijfsuren", "uren", "uur"] },
  searchWords: ["bandenkraan", "mobiele graafmachine"],
  acceptCookies: ["Alles accepteren", "Accepteren", "Akkoord"],
  examples: {
    wheeled: ["Bandenkraan Hyundai R140W-7", "Banden kraan Doosan DX140W", "Mobiele graafmachine Hyundai Robex 140W"],
    keep: ["Graafmachine Hyundai R140 van Janssen Verhuur"],
    drop: ["Doosan DX140 graafmachine te huur", "Banden voor Hyundai R140W graafmachine", "Onderdelen Doosan DX55 graver", "Kawasaki ruilpomp tbv Hyundai Robex 140W-9 graafmachine"],
  },
};
