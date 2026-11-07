import { getSupabase } from "./supabase";

export type ScraperSettings = {
  /** read only Mobilbagger search pages and keep only wheeled machines */
  mobileOnly: boolean;
};

export const DEFAULT_SETTINGS: ScraperSettings = { mobileOnly: true };

/** Stored values over the defaults, so settings added later still have a value. Throws if the database fails. */
export async function loadSettings(): Promise<ScraperSettings> {
  const sb = getSupabase();
  if (!sb) return DEFAULT_SETTINGS;
  const { data, error } = await sb.from("scraper_settings").select("settings").eq("id", 1).maybeSingle();
  if (error) throw new Error(`Could not read scraper settings: ${error.message}`);
  return { ...DEFAULT_SETTINGS, ...(data?.settings as Partial<ScraperSettings> | undefined) };
}

export async function saveSettings(settings: ScraperSettings): Promise<void> {
  const sb = getSupabase();
  if (!sb) throw new Error("Saving settings needs Supabase.");
  const { error } = await sb.from("scraper_settings").upsert({ id: 1, settings, updated_at: new Date().toISOString() });
  if (error) throw new Error(`Could not save scraper settings: ${error.message}`);
}
