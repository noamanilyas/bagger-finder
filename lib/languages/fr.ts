import type { Language } from "./types";

export const fr: Language = {
  code: "fr",
  name: "Français",
  excavator: ["pelleteuse*", "minipelle*", "mini pelle*", "excavatrice*"],
  wheeled: ["pelle* sur pneu*", "pelle* à pneu*", "pelle* pneu*", "pelle* mobile*", "pelleteuse* sur pneu*"],
  tracked: ["pelle* sur chenille*", "pelle* à chenille*", "pelle* chenille*"],
  grader: ["niveleuse*"],
  loader: ["chargeuse*"],
  roller: ["rouleau*", "compacteur*"],
  weakExcavator: ["pelle", "pelles"],
  // Never plain "location" anywhere in an ad: it means rental here, but cards also say "Location: Germany".
  notForSale: ["à louer", "en location", "louer", "par jour", "je recherche", "cherche", "recherché", "recherchée", "recherchons", "chariot élévateur*"],
  // "pneu" at the start is a tyre ad; "pelle sur pneus" further on is the machine we want.
  partAtStart: ["location", "pneu*", "jante*", "chenille*", "godet*", "moteur*", "pièce*", "vérin*", "attache rapide", "pompe hydraulique"],
  labels: { year: ["année", "annee"], hours: ["heures", "heure"] },
  searchWords: ["pelle sur pneus", "pelle à pneu"],
  acceptCookies: ["Tout accepter", "Accepter tout", "Accepter", "J'accepte"],
  examples: {
    wheeled: ["Pelle sur pneus Hyundai R140W-7", "Pelle a pneu Doosan DX140W", "Pelleteuse sur pneus Hyundai Robex 140W"],
    keep: ["Pelle Hyundai R140, pneus neufs"],
    drop: ["Recherché : pelle Doosan DX55", "Location pelle Doosan DX140", "Pelle Hyundai R140 à louer", "Pneus pour pelle Hyundai R140W", "Godet pour pelle Doosan DX55"],
  },
};
