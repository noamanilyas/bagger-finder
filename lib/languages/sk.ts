import type { Language } from "./types";

export const sk: Language = {
  code: "sk",
  name: "Slovenčina",
  excavator: ["rýpadl*", "bager*", "bagr*"],
  wheeled: ["kolesov* rýpadl*", "rýpadl* kolesov*", "kolesov* bager*", "kolesov* bagr*"],
  tracked: ["pásov* rýpadl*", "rýpadl* pásov*"],
  notForSale: ["prenájom", "prenajmem", "kúpim", "hľadám", "čeln* nakladač*"],
  partAtStart: ["náhradn* diel*", "diely", "pneumatik*", "kolesá", "koleso", "pásy", "lyžic*", "motor*", "čerpadlo"],
  labels: { year: ["rok výroby"], hours: ["motohodín", "mth", "hodín"] },
  searchWords: ["kolesové rýpadlo"],
  acceptCookies: ["Prijať všetko", "Súhlasím"],
  examples: {
    wheeled: ["Kolesové rýpadlo Hyundai R140W-7", "kolesove rypadlo Doosan DX140W"],
    drop: ["Prenájom rýpadlo Doosan DX140", "Pneumatiky na rýpadlo Hyundai R140W"],
  },
};
