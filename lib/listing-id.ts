import crypto from "node:crypto";

/** The ad's address without tracking parameters or fragment, so the same ad always gets the same id. */
export function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/.test(k)) url.searchParams.delete(k);
    return url.toString();
  } catch {
    return u;
  }
}

/** A listing's id. Shared by the scraper and the ingest API, so an ad from both is stored once. */
export const listingId = (url: string) => crypto.createHash("sha1").update(normalizeUrl(url)).digest("hex").slice(0, 16);
