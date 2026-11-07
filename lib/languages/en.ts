import type { Language } from "./types";

export const en: Language = {
  code: "en",
  name: "English",
  excavator: [/excavator/, "digger*"],
  wheeled: [/mobile excavator|wheel(?:ed)? excavator/, "wheeled digger*"],
  tracked: ["crawler excavator*", "tracked excavator*"],
  grader: ["*grader*"],
  loader: ["wheel loader*"],
  roller: ["*roller*", "*compactor*"],
  // Not "rental" or "parts": dealers are called "XYZ Rental" and machines come "with spare parts".
  // Not "per month": sale ads quote leasing rates.
  notForSale: ["for rent", "for hire", "hire only", "per day", "per week", "wanted", "forklift*"],
  partAtStart: ["spare part*", "parts for", "tyre*", "tire*", "rim*", "track*", "bucket*", "engine*", "hydraulic pump*", "quick coupler*", "cylinder*"],
  labels: { year: ["year", "year of manufacture", "manufacture year"], hours: ["hours", "hrs", "operating hours", "engine hours"] },
  searchWords: ["wheeled excavator", "wheel excavator"],
  acceptCookies: ["Accept all", "Accept"],
  examples: {
    wheeled: ["Hyundai R140W-9 wheel excavator", "Doosan DX140W wheeled excavator 2012"],
    keep: ["Hyundai Robex 140 excavator with spare parts", "Yanmar B55 excavator from ACME Rental"],
    drop: ["Doosan DX140 excavator for hire", "Bucket for Hyundai R140 excavator", "Tyres for Doosan DX140W"],
  },
};
