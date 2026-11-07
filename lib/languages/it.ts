import type { Language } from "./types";

export const it: Language = {
  code: "it",
  name: "Italiano",
  excavator: ["escavator*", "miniescavator*", "escavatric*"],
  wheeled: ["escavator* gommat*", "escavator* su gomm*", "escavator* su ruote", "escavator* mobil*"],
  tracked: ["escavator* cingolat*", "escavator* su cingol*"],
  grader: ["livellatric*", "motolivellatric*"],
  // Not plain "pala": it is also a blade or a shovel.
  loader: ["pala gommata", "pale gommate", "pala caricatrice", "pale caricatrici"],
  roller: ["rullo compressore", "rulli compressori", "rullo vibrante", "rulli vibranti", "compattator*"],
  // Not plain "noleggio": dealers write "vendita e noleggio" on machines they sell.
  notForSale: ["a noleggio", "in noleggio", "noleggio giornaliero", "affittasi", "in affitto", "cerco", "compro", "muletto", "carrello elevatore"],
  partAtStart: ["ricambi*", "pneumatic*", "gomme", "cerchi*", "cingoli", "cingolo", "benna", "benne", "motore", "pompa*", "attacco rapido", "cilindr*"],
  labels: { year: ["anno di costruzione", "anno", "immatricolazione"], hours: ["ore di lavoro", "ore lavoro", "ore"] },
  searchWords: ["escavatore gommato"],
  acceptCookies: ["Accetta tutti", "Accetta", "Accetto"],
  examples: {
    wheeled: ["Escavatore gommato Hyundai R140W-7", "Escavatore su gomma Doosan DX140W"],
    keep: ["Escavatore Hyundai R140 vendita e noleggio"],
    drop: ["Escavatore Doosan DX140 a noleggio", "Pneumatici per escavatore Hyundai R140W", "Benna per escavatore Doosan DX55"],
  },
};
