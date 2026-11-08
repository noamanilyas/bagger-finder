import { countryOf } from "./countries";
import type { Listing } from "./types";

/**
 * The same machine is often advertised on several sites, and sometimes twice on one site, each time written a little
 * differently ("DX140W-3", "DX140 W 3"; "Fürth (Hessen)", "Hessen, Germany"). Each ad is stored on its own, keyed by
 * its address; this module decides which ads are one machine, so it is shown and counted once.
 *
 * Two ads are one machine when they have the same model, type and price, nothing contradicts (year, hours, country),
 * and something positive agrees: the same year, the same hours, or the same town. Missing facts never contradict,
 * so an ad without year and hours still joins a machine in the same town at the same price.
 */

const fold = (s: string) => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();

/** Place words that name a town or region, not a country: "Fürth ( Hessen ), Deutschland" -> fürth, hessen. */
function placeWords(place: string | null): Set<string> {
  if (!place) return new Set();
  return new Set(fold(place).split(/[^\p{L}]+/u).filter((w) => w.length >= 4 && !countryOf(w)));
}

const known = <T>(a: T | null, b: T | null) => a != null && b != null;

/** Nothing about the two ads says they are different machines. */
function compatible(a: Listing, b: Listing): boolean {
  if (known(a.year, b.year) && a.year !== b.year) return false;
  if (known(a.hours, b.hours) && a.hours !== b.hours) return false;
  const ca = countryOf(a.location)?.code;
  const cb = countryOf(b.location)?.code;
  return !(ca && cb && ca !== cb);
}

/** Something about the two ads says they are the same machine, beyond model and price. */
function agree(a: Listing, b: Listing): boolean {
  if (known(a.year, b.year) && a.year === b.year) return true;
  if (known(a.hours, b.hours) && a.hours === b.hours) return true;
  const wa = placeWords(a.location);
  for (const w of placeWords(b.location)) if (wa.has(w)) return true;
  return false;
}

/** How much an ad tells: the fullest ad of a machine is the one shown. */
const filled = (l: Listing) =>
  [l.year, l.hours, l.make, l.model, l.location, l.imageUrl, l.lat].filter((v) => v != null).length + (l.location?.includes(",") ? 1 : 0);

const better = (a: Listing, b: Listing) => filled(b) - filled(a) || b.lastSeen.localeCompare(a.lastSeen) || a.id.localeCompare(b.id);

/** The ads grouped into machines, the fullest ad first in each group. Ads without a price are never grouped. */
export function machineGroups(listings: Listing[]): Listing[][] {
  const buckets = new Map<string, Listing[]>();
  const groups: Listing[][] = [];
  for (const l of listings) {
    if (l.priceEur == null) {
      groups.push([l]);
      continue;
    }
    const key = `${l.modelKey}|${l.wheeled}|${l.priceEur}`;
    (buckets.get(key) ?? buckets.set(key, []).get(key)!).push(l);
  }
  for (const bucket of buckets.values()) {
    const mine: Listing[][] = [];
    // Fullest ads first, so a machine is built around the ads that say most about it.
    for (const l of [...bucket].sort(better)) {
      const g = mine.find((m) => m.every((o) => compatible(l, o)) && m.some((o) => agree(l, o)));
      if (g) g.push(l);
      else mine.push([l]);
    }
    groups.push(...mine);
  }
  return groups;
}

/** Each ad's machine, as the id of the ad shown for it. */
export function machineOf(listings: Listing[]): Map<string, string> {
  const of = new Map<string, string>();
  for (const g of machineGroups(listings)) for (const l of g) of.set(l.id, g[0].id);
  return of;
}

/** One listing per machine: the fullest ad, with the other ads of the same machine under alsoOn. */
export function oneCardPerMachine(listings: Listing[]): Listing[] {
  return machineGroups(listings).map(([main, ...rest]) => {
    if (rest.length === 0) return main;
    const notes = new Map([main, ...rest].flatMap((l) => l.knowledge ?? []).map((k) => [k.id, k]));
    return {
      ...main,
      alsoOn: rest.map((l) => ({ id: l.id, source: l.source, url: l.url })),
      ...(notes.size > 0 ? { knowledge: [...notes.values()] } : {}),
    };
  });
}

/** Machines advertised more than once, and how many ads too many that makes. Logged by the scraper. */
export function duplicateCount(listings: Listing[]): { machines: number; extraAds: number } {
  let machines = 0;
  let extraAds = 0;
  for (const g of machineGroups(listings)) {
    if (g.length < 2) continue;
    machines++;
    extraAds += g.length - 1;
  }
  return { machines, extraAds };
}
