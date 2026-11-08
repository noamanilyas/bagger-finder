/**
 * Sites an external system extracts and sends to POST /api/ingest, each with how often it should send them.
 * The system asks GET /api/ingest/due before extracting a site; the site counts as extracted when machines from it
 * arrive (or the system reports it with `site` and no machines). Also used in the browser: no Node-only imports.
 */

export type ExternalSite = { site: string; intervalMinutes: number };

/** Choices offered in the app. The API accepts any whole number of minutes in range. */
export const EXTERNAL_INTERVALS = [
  { minutes: 5, label: "Every 5 minutes" },
  { minutes: 10, label: "Every 10 minutes" },
  { minutes: 15, label: "Every 15 minutes" },
  { minutes: 30, label: "Every 30 minutes" },
  { minutes: 60, label: "Every hour" },
  { minutes: 120, label: "Every 2 hours" },
  { minutes: 360, label: "Every 6 hours" },
  { minutes: 720, label: "Every 12 hours" },
  { minutes: 1440, label: "Once a day" },
] as const;

/** Listings not seen for 3 days are removed, so a site must be sent at least once a day to stay on the list. */
export const MAX_INTERVAL_MINUTES = 1440;

export const isExternalInterval = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= MAX_INTERVAL_MINUTES;

/** "https://www.Mobile.de/path" or "mobile.de" → "mobile.de". Null when it is not a host name. */
export function normalizeSite(value: unknown): string | null {
  if (typeof value !== "string") return null;
  let v = value.trim().toLowerCase();
  if (!v) return null;
  try {
    v = new URL(v.includes("://") ? v : `https://${v}`).hostname;
  } catch {
    return null;
  }
  v = v.replace(/^www\./, "").replace(/\.$/, "");
  return /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(v) ? v : null;
}

/** The listed site an address belongs to: "suchen.mobile.de" is mobile.de. The most specific entry wins. */
export function siteOfUrl(url: string, sites: ExternalSite[]): ExternalSite | null {
  const host = normalizeSite(url);
  if (!host) return null;
  let best: ExternalSite | null = null;
  for (const s of sites) {
    if ((host === s.site || host.endsWith(`.${s.site}`)) && (!best || s.site.length > best.site.length)) best = s;
  }
  return best;
}

/** The checked list, or what is wrong with it. A site named twice keeps its last interval. */
export function parseExternalSites(input: unknown): ExternalSite[] | string {
  if (!Array.isArray(input)) return "externalSites must be a list of { site, intervalMinutes }";
  const bySite = new Map<string, ExternalSite>();
  for (const entry of input) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const site = normalizeSite(e.site);
    if (!site) return `not a site name: ${JSON.stringify(e.site)}`;
    if (!isExternalInterval(e.intervalMinutes)) return `intervalMinutes for ${site} must be a whole number from 1 to ${MAX_INTERVAL_MINUTES}`;
    bySite.set(site, { site, intervalMinutes: e.intervalMinutes });
  }
  return [...bySite.values()];
}

export type SiteDue = {
  site: string;
  /** on the list; a site that is not is never due */
  listed: boolean;
  /** true: extract and send it now */
  due: boolean;
  intervalMinutes: number | null;
  lastReceivedAt: string | null;
  /** when it is due again; null when due now or not listed */
  nextDueAt: string | null;
};

/** Whether a site should be extracted now. Never received yet: yes. */
export function siteDue(name: string, sites: ExternalSite[], lastReceived: Record<string, string>, now = Date.now()): SiteDue {
  const site = normalizeSite(name) ?? name.trim().toLowerCase();
  const entry = sites.find((s) => s.site === site) ?? null;
  const lastReceivedAt = entry ? (lastReceived[entry.site] ?? null) : null;
  if (!entry) return { site, listed: false, due: false, intervalMinutes: null, lastReceivedAt: null, nextDueAt: null };
  const next = lastReceivedAt ? Date.parse(lastReceivedAt) + entry.intervalMinutes * 60_000 : null;
  const due = next == null || now >= next;
  return { site, listed: true, due, intervalMinutes: entry.intervalMinutes, lastReceivedAt, nextDueAt: due || next == null ? null : new Date(next).toISOString() };
}

/**
 * Listed sites whose machines (or an empty run, sent with `site`) have not arrived within the site's own interval
 * (Scraper settings → External sites), or never have: every 5 minutes and nothing for 6 minutes is late.
 */
export function staleSites(sites: ExternalSite[], lastReceived: Record<string, string>, now = Date.now()): ExternalSite[] {
  return sites.filter((s) => {
    const last = lastReceived[s.site];
    return !last || now - Date.parse(last) > s.intervalMinutes * 60_000;
  });
}
