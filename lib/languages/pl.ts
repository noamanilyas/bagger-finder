import type { Language } from "./types";

export const pl: Language = {
  code: "pl",
  name: "Polski",
  excavator: ["kopark*"],
  wheeled: ["kopark* kołow*", "kopark* na kołach"],
  tracked: ["kopark* gąsienicow*"],
  // Not plain "wynajem": dealers advertise "sprzedaż i wynajem" on machines they are selling.
  notForSale: ["na wynajem", "do wynajęcia", "wynajmę", "wynajem kopark*", "wypożyczę", "kupię", "poszukuję", "szukam", "ładowark* kołow*", "wózek widłowy"],
  partAtStart: ["części", "część", "opon*", "koła", "koło", "gąsienic*", "łyżk*", "silnik*", "pomp*", "szybkozłącz*", "siłownik*", "lemiesz*"],
  labels: { year: ["rok produkcji", "rocznik"], hours: ["motogodzin*", "mtg", "mth", "godzin*"] },
  searchWords: ["koparka kołowa"],
  acceptCookies: ["Akceptuję", "Zaakceptuj wszystko", "Akceptuj wszystkie", "Zgadzam się"],
  examples: {
    wheeled: ["Koparka kołowa Hyundai R140W-7", "KOPARKA KOLOWA Hyundai Robex 140W", "koparki kołowe Doosan DX140W"],
    keep: ["Koparka Hyundai R140 sprzedaż i wynajem"],
    drop: ["Koparka Doosan DX140 na wynajem", "Opony do koparki Hyundai R140W", "Części do koparki Doosan DX55"],
  },
};
