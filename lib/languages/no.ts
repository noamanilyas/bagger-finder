import type { Language } from "./types";

export const no: Language = {
  code: "no",
  name: "Norsk",
  excavator: ["gravemaskin*", "graver", "gravere", "minigraver*", "beltegraver*", "hjulgraver*"],
  wheeled: ["hjulgraver*", "hjulgravemaskin*", "hjulmaskin*"],
  tracked: ["beltegraver*", "beltegravemaskin*"],
  notForSale: ["til leie", "utleie", "leies ut", "ønskes kjøpt", "kjøpes", "per dag", "hjullaster*", "gaffeltruck*"],
  partAtStart: ["deler", "reservedeler", "dekk", "felg*", "belter", "skuffe*", "motor*", "pumpe*", "hurtigkobling*"],
  labels: { year: ["årsmodell", "årgang"], hours: ["driftstimer", "timer"] },
  searchWords: ["hjulgraver"],
  acceptCookies: ["Godta alle", "Aksepter", "Jeg godtar"],
  examples: {
    wheeled: ["Hjulgraver Hyundai R140W-7", "Hjulgravemaskin Doosan DX140W"],
    drop: ["Doosan DX140 gravemaskin til leie", "Dekk til Hyundai R140W hjulgraver"],
  },
};
