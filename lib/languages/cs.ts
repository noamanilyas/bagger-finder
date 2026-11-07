import type { Language } from "./types";

export const cs: Language = {
  code: "cs",
  name: "Čeština",
  excavator: ["rýpadl*", "bagr*"],
  wheeled: ["kolov* rýpadl*", "rýpadl* kolov*", "kolov* bagr*", "bagr* kolov*"],
  tracked: ["pásov* rýpadl*", "rýpadl* pásov*"],
  notForSale: ["pronájem", "k pronájmu", "pronajmu", "koupím", "hledám", "sháním", "čeln* nakladač*", "vysokozdvižn* vozík*"],
  // Whole words: "kola" is a wheel ad, "kolové rýpadlo" is the machine we want.
  partAtStart: ["náhradní díl*", "díly", "díl", "pneu*", "kola", "kolo", "pásy", "lžíc*", "motor*", "čerpadlo", "válec", "rychloupínák*"],
  labels: { year: ["rok výroby"], hours: ["motohodin*", "mth", "hodin*"] },
  searchWords: ["kolové rýpadlo"],
  acceptCookies: ["Přijmout vše", "Souhlasím", "Rozumím"],
  examples: {
    wheeled: ["Kolové rýpadlo Hyundai R140W-7", "KOLOVE RYPADLO Doosan DX140W"],
    drop: ["Pronájem rýpadlo Doosan DX140", "Kola na rýpadlo Hyundai R140W", "Díly rýpadlo Doosan DX55"],
  },
};
