import { readGeoCache, writeGeoCache, type GeoCache } from "../lib/store";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lastCall = 0;

/**
 * Resolve a location string ("12681 Berlin") to coordinates using OpenStreetMap Nominatim.
 * Results are cached on disk; Nominatim's policy allows max 1 request/second.
 */
export async function geocode(
  location: string | null,
  cache: GeoCache = readGeoCache(),
): Promise<{ lat: number; lng: number } | null> {
  if (!location) return null;
  const key = location.trim().toLowerCase();
  if (key in cache) return cache[key];

  const wait = 1100 - (Date.now() - lastCall);
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();

  const q = /\b[A-Za-z]{2,}\b.*(deutschland|germany|österreich|schweiz|polen|tschechien)/i.test(location)
    ? location
    : `${location}, Deutschland`;
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`,
      { headers: { "User-Agent": "bagger-finder/0.1 (personal excavator search)" } },
    );
    if (!res.ok) return null; // do not cache transient failures
    const data = (await res.json()) as { lat: string; lon: string }[];
    const hit = data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    cache[key] = hit;
    writeGeoCache(cache);
    return hit;
  } catch {
    return null;
  }
}
