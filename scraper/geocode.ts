import { countryOf } from "../lib/countries";
import { readGeoCache, writeGeoCache, type GeoCache } from "../lib/store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;

/**
 * Resolve a location string ("12681 Berlin") to coordinates using OpenStreetMap Nominatim.
 * Results are cached on disk; Nominatim's policy allows max 1 request/second.
 * `defaultCountry` is tried first for a place that names no country: the source's home country, or null for none.
 */
export async function geocode(
  location: string | null,
  cache: GeoCache = readGeoCache(),
  defaultCountry: string | null = "Deutschland",
): Promise<{ lat: number; lng: number } | null> {
  if (!location) return null;
  // "Neustadt" is a different place per country, so the cache must tell them apart. German keys stay as they were.
  const scope = defaultCountry === "Deutschland" ? "" : `${defaultCountry ?? "any"}|`;
  const key = `${scope}${location.trim().toLowerCase()}`;
  if (key in cache) return cache[key];

  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const search = async (q: string) => {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "bagger-finder/0.1 (personal excavator search)" } },
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as { lat: string; lon: string }[];
    return data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
  };

  try {
    const guessCountry = defaultCountry != null && !countryOf(location);
    let hit = await search(guessCountry ? `${location}, ${defaultCountry}` : location);
    if (!hit && guessCountry) {
      // no country given and not a place in the home country: try the name on its own
      await sleep(1100);
      lastCall = Date.now();
      hit = await search(location);
    }
    cache[key] = hit;
    writeGeoCache(cache);
    return hit;
  } catch {
    return null; // do not cache transient failures
  }
}
