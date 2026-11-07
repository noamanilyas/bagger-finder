import type { Language } from "./types";

export const fi: Language = {
  code: "fi",
  name: "Suomi",
  excavator: ["kaivinkone*", "kaivuri*", "minikaivinkone*", "pyöräkaivuri*", "telakaivuri*", "telakaivinkone*"],
  wheeled: ["pyöräkaivuri*", "pyöräkaivinkone*", "pyöräalustai* kaivinkone*"],
  tracked: ["telakaivuri*", "telakaivinkone*", "tela-alustai* kaivinkone*"],
  grader: ["tiehöylä*"],
  loader: ["pyöräkuormaaja*", "kauhakuormaaja*"],
  roller: ["jyrä", "jyrät", "valssijyrä*", "täryjyrä*"],
  // Not plain "vuokraus": dealers write "myynti ja vuokraus" on machines they sell.
  notForSale: ["vuokrataan", "vuokralle", "ostetaan", "halutaan ostaa", "trukki*"],
  // Not "kauha*": "kauhakuormaaja" is a wheel loader, which is on the list.
  partAtStart: ["varaosat", "varaosa", "renkaat", "rengas", "vanne*", "telat", "kauha", "kauhat", "kauhan", "moottori*", "pumppu*", "pikakiinnik*", "pikaliitin*"],
  labels: { year: ["vuosimalli", "valmistusvuosi", "vm"], hours: ["käyttötunnit", "tunnit"] },
  searchWords: ["pyöräkaivuri", "pyöräalustainen kaivinkone"],
  acceptCookies: ["Hyväksy kaikki", "Salli kaikki", "Hyväksy"],
  examples: {
    wheeled: ["Pyöräkaivuri Hyundai R140W-7", "Pyöräalustainen kaivinkone Doosan DX140W"],
    drop: ["Doosan DX140 kaivinkone vuokrataan", "Renkaat Hyundai R140W pyöräkaivuriin", "Kauha Doosan DX55 kaivinkoneeseen"],
  },
};
