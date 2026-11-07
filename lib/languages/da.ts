import type { Language } from "./types";

export const da: Language = {
  code: "da",
  name: "Dansk",
  excavator: ["gravemaskine*", "minigraver*", "larvegraver*", "hjulgraver*"],
  wheeled: ["hjulgraver*", "hjul graver*", "gravemaskine* på hjul", "hjulgravemaskine*"],
  tracked: ["larvegraver*", "larvegravemaskine*"],
  grader: ["vejhøvl*"],
  loader: ["læssemaskine*", "gummiged*"],
  roller: ["*tromle", "*tromler"],
  // Not plain "hjul" at the start: "hjul gravemaskine" is how some sellers write the machine we want.
  notForSale: ["til leje", "udlejes", "lejes", "købes", "ønskes købt", "pr. dag", "gaffeltruck*"],
  partAtStart: ["reservedele", "dele", "dæk", "fælg*", "larvebånd", "skovl*", "motor*", "pumpe*", "hurtigskift*"],
  labels: { year: ["årgang", "årstal"], hours: ["driftstimer", "timer"] },
  searchWords: ["hjulgraver", "gravemaskine på hjul"],
  acceptCookies: ["Accepter alle", "Tillad alle", "Acceptér"],
  examples: {
    wheeled: ["Hjulgraver Hyundai R140W-7", "Gravemaskine på hjul Doosan DX140W"],
    drop: ["Doosan DX140 gravemaskine til leje", "Dæk til Hyundai R140W hjulgraver"],
  },
};
