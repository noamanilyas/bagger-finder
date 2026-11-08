import crypto from "node:crypto";
import { normalizeUrl } from "./ad-url";

export { normalizeUrl };

/** A listing's id. Shared by the scraper and the ingest API, so an ad from both is stored once. */
export const listingId = (url: string) => crypto.createHash("sha1").update(normalizeUrl(url)).digest("hex").slice(0, 16);
