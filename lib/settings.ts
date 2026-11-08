import { DEFAULT_INTERVAL_MINUTES, DEFAULT_QUIET, isClockTime, isIntervalChoice, type QuietHours } from "./schedule";
import { DEFAULT_SITE_HOURS, isSiteFrequency, type SiteHours } from "./site-schedule";
import { getSupabase } from "./supabase";
import { parseExternalSites, type ExternalSite } from "./external-sites";

export type ScraperSettings = {
  /** read only Mobilbagger search pages and keep only wheeled machines */
  mobileOnly: boolean;
  /** minutes between automatic scrapes: one of INTERVAL_CHOICES */
  intervalMinutes: number;
  /** no automatic scrapes in these hours (German time); null: scrape around the clock */
  quiet: QuietHours | null;
  /** hours between two automatic reads of a site, by source id (see lib/site-schedule.ts); others every run */
  siteHours: SiteHours;
  /** sites an external system sends to POST /api/ingest, and how often (see lib/external-sites.ts) */
  externalSites: ExternalSite[];
};

export const DEFAULT_SETTINGS: ScraperSettings = {
  mobileOnly: true,
  intervalMinutes: DEFAULT_INTERVAL_MINUTES,
  quiet: DEFAULT_QUIET,
  siteHours: DEFAULT_SITE_HOURS,
  externalSites: [],
};

/** Stored values over the defaults, so settings added later still have a value. Throws if the database fails. */
export async function loadSettings(): Promise<ScraperSettings> {
  const sb = getSupabase();
  if (!sb) return DEFAULT_SETTINGS;
  const { data, error } = await sb.from("scraper_settings").select("settings").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Could not read scraper settings: ${error.message}`);
  const stored = (data?.settings ?? {}) as Partial<ScraperSettings>;
  const externalSites = parseExternalSites(stored.externalSites ?? []);
  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    siteHours: { ...DEFAULT_SETTINGS.siteHours, ...stored.siteHours },
    externalSites: typeof externalSites === "string" ? [] : externalSites,
  };
}

export async function saveSettings(settings: ScraperSettings): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Saving settings needs Supabase.");
  const { error } = await sb.from("scraper_settings").upsert({ id: 1, settings, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Could not save scraper settings: ${error.message}`);
}

/**
 * A change sent by the app, checked: the settings with it applied, or what is wrong with it. Only the fields given
 * change; siteHours changes the sites it names. `knownSites` keeps typos out of the stored settings.
 */
export function applyChange(current: ScraperSettings, body: unknown, knownSites: string[]): ScraperSettings | string {
  if (!body || typeof body !== "object") return "Nothing to change";
  const { mobileOnly, intervalMinutes, quiet, siteHours, externalSites } = body as Record<string, unknown>;
  if ([mobileOnly, intervalMinutes, quiet, siteHours, externalSites].every((v) => v === undefined)) return "Nothing to change";
  // the whole list is sent, so removing a site is sending the list without it
  const external = externalSites === undefined ? undefined : parseExternalSites(externalSites);
  if (typeof external === "string") return external;
  if (mobileOnly !== undefined && typeof mobileOnly !== "boolean") return "mobileOnly must be true or false";
  if (intervalMinutes !== undefined && !isIntervalChoice(intervalMinutes)) return "intervalMinutes is not one of the choices";
  if (quiet !== undefined && quiet !== null) {
    const q = quiet as Partial<QuietHours>;
    if (typeof quiet !== "object" || !isClockTime(q.from) || !isClockTime(q.until)) return "quiet needs from and until as HH:MM, or null";
  }
  if (siteHours !== undefined) {
    if (!siteHours || typeof siteHours !== "object") return "siteHours must name sites";
    for (const [id, hours] of Object.entries(siteHours)) {
      if (!knownSites.includes(id)) return `unknown site: ${id}`;
      if (!isSiteFrequency(hours)) return `siteHours for ${id} is not one of the choices`;
    }
  }
  return {
    ...current,
    ...(mobileOnly !== undefined && { mobileOnly: mobileOnly as boolean }),
    ...(intervalMinutes !== undefined && { intervalMinutes: intervalMinutes as number }),
    ...(quiet !== undefined && { quiet: quiet === null ? null : { from: (quiet as QuietHours).from, until: (quiet as QuietHours).until } }),
    ...(siteHours !== undefined && { siteHours: { ...current.siteHours, ...(siteHours as SiteHours) } }),
    ...(external !== undefined && { externalSites: external }),
  };
}
