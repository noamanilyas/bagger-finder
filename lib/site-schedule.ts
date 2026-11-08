/**
 * How often each site is read by the automatic scrapes. Big portals with strict limits can be read once a day while
 * the small national sites are read every run. "Refresh now" always reads every site. Also used in the browser.
 *
 * Listings not seen for 3 days are removed (scraper/run.ts), so once a day is the slowest choice.
 */

export const SITE_FREQUENCIES = [
  { hours: 0, label: "Every run" },
  { hours: 12, label: "Every 12 hours" },
  { hours: 24, label: "Once a day" },
] as const;

export const isSiteFrequency = (v: unknown): v is number => SITE_FREQUENCIES.some((f) => f.hours === v);

/** Hours between two reads of a site, by source id. Sites not named here are read every run. */
export type SiteHours = Record<string, number>;

/** The portals that refused or rate-limited the scraper, or that hold the most pages. */
export const DEFAULT_SITE_HOURS: SiteHours = { machineryline: 24, mascus: 24, truckscout24: 24, leboncoin: 24 };

export const hoursFor = (siteHours: SiteHours, sourceId: string): number => siteHours[sourceId] ?? 0;

/**
 * Runs start a few minutes apart from one day to the next, so a site read every 12 hours on a 6-hour schedule would
 * slip to every third run without this allowance.
 */
const SLACK_MS = 45 * 60_000;

/** Whether an automatic scrape should read this site now. Never read yet, or read every run: yes. */
export function isSiteDue(lastReadAt: string | null | undefined, hours: number, now = Date.now()): boolean {
  if (hours <= 0 || !lastReadAt) return true;
  return now - Date.parse(lastReadAt) >= hours * 3_600_000 - SLACK_MS;
}

/** When a site is next read, for showing in the app; null when it is read every run or has not been read yet. */
export function nextSiteRead(lastReadAt: string | null | undefined, hours: number): string | null {
  if (hours <= 0 || !lastReadAt) return null;
  return new Date(Date.parse(lastReadAt) + hours * 3_600_000 - SLACK_MS).toISOString();
}
