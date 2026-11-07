import type { Language } from "./types";

export const sv: Language = {
  code: "sv",
  name: "Svenska",
  excavator: ["grävmaskin*", "grävare", "minigrävare*", "hjulgrävare*", "bandgrävare*"],
  wheeled: ["hjulgrävare*", "hjulgrävmaskin*", "hjulburen grävmaskin*"],
  tracked: ["bandgrävare*", "bandgrävmaskin*"],
  grader: ["väghyvel", "väghyvlar", "väghyveln"],
  loader: ["hjullastare*"],
  roller: ["*vält", "*vältar", "*välten"],
  // Not plain "uthyrning": dealers write "försäljning och uthyrning" on machines they sell.
  notForSale: ["uthyres", "hyr ut", "att hyra", "per dag", "köpes", "sökes", "gaffeltruck*"],
  partAtStart: ["reservdelar", "delar", "däck", "fälg*", "band", "skopa", "skopor", "motor*", "pump*", "snabbfäste*"],
  labels: { year: ["årsmodell", "tillverkningsår"], hours: ["drifttimmar", "timmar", "tim"] },
  searchWords: ["hjulgrävare"],
  acceptCookies: ["Godkänn alla", "Acceptera alla", "Jag godkänner"],
  examples: {
    wheeled: ["Hjulgrävare Hyundai R140W-7", "Hjulgrävmaskin Doosan DX140W"],
    drop: ["Doosan DX140 grävmaskin uthyres", "Däck till Hyundai R140W hjulgrävare", "Skopa för Doosan DX55 grävmaskin"],
  },
};
