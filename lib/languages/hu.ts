import type { Language } from "./types";

export const hu: Language = {
  code: "hu",
  name: "Magyar",
  excavator: ["kotró*", "*kotrógép*", "exkavátor*"],
  wheeled: ["gumikerekes kotró*", "gumis kotró*", "kerekes kotró*", "gumikerekes exkavátor*", "gumikerekes forgó*"],
  tracked: ["lánctalpas*"],
  notForSale: ["bérlés*", "bérbeadó*", "bérelhető", "kiadó", "keresek", "homlokrakodó*", "targonca"],
  partAtStart: ["alkatrész*", "gumiabroncs*", "felni*", "kerék", "lánctalp*", "kanál", "motor*", "szivattyú*", "henger*"],
  labels: { year: ["évjárat", "gyártási év"], hours: ["üzemóra", "üzemórás", "üó"] },
  searchWords: ["gumikerekes kotró"],
  acceptCookies: ["Összes elfogadása", "Elfogadom"],
  examples: {
    wheeled: ["Gumikerekes kotró Hyundai R140W-7", "GUMIKEREKES KOTRO Doosan DX140W"],
    drop: ["Kotró bérlés Doosan DX140", "Alkatrész Hyundai R140W kotró"],
  },
};
