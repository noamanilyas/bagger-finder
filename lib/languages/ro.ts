import type { Language } from "./types";

export const ro: Language = {
  code: "ro",
  name: "Română",
  excavator: ["excavator*"],
  // Both comma-below (ț) and the older cedilla (ţ) spellings are in use; loose matching also accepts plain "t".
  wheeled: ["excavator* pe roți", "excavator* pe roţi", "excavator* pe pneuri"],
  tracked: ["excavator* pe șenil*", "excavator* pe şenil*"],
  grader: ["*greder*"],
  loader: ["încărcător frontal"],
  roller: ["compactor*"],
  notForSale: ["închiriez", "închiriere", "de închiriat", "cumpăr", "caut", "stivuitor*"],
  partAtStart: ["piese", "piesă", "anvelop*", "jante", "șenil*", "cupă", "motor*", "pompă", "cilindru", "lanțuri"],
  labels: { year: ["an fabricație", "anul fabricației", "an de fabricație"], hours: ["ore"] },
  searchWords: ["excavator pe roți"],
  acceptCookies: ["Acceptă tot", "Accept tot", "Accept"],
  examples: {
    wheeled: ["Excavator pe roți Hyundai R140W-7", "Excavator pe roti Doosan DX140W", "Excavator pe roţi Hyundai Robex 140W"],
    drop: ["Închiriez excavator Doosan DX140", "Piese excavator Hyundai R140W"],
  },
};
