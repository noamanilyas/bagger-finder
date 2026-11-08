/**
 * Sites that refused the scraper rest before they are asked again: 24 hours after the first block, then twice as long
 * each time it happens again, up to a week, or longer when the site asks for that (Retry-After). A run that reads the
 * site without a block clears its record. Kept in Supabase (table source_health), else in the data folder.
 */
import { readHealthFile, writeHealthFile, type HealthFile } from "./store";
import { getSupabase } from "./supabase";

/** lastReadAt: when an automatic or manual scrape last read the site, for sites not read every run (lib/site-schedule.ts) */
export type Health = { blockedUntil: string | null; strikes: number; lastError: string | null; lastReadAt?: string | null };
export type HealthMap = Record<string, Health>;

const DAY_MS = 24 * 60 * 60_000;
const MAX_REST_MS = 7 * DAY_MS;

/** How long a site rests after its nth block in a row, at least as long as it asked for. */
export function restMs(strikes: number, retryAfterMs: number | null = null): number {
  const backoff = Math.min(MAX_REST_MS, DAY_MS * 2 ** Math.max(0, strikes - 1));
  return Math.max(backoff, Math.min(retryAfterMs ?? 0, MAX_REST_MS));
}

/** The record after a block. */
export function afterBlock(prev: Health | undefined, reason: string, now: number, retryAfterMs: number | null = null): Health {
  const strikes = (prev?.strikes ?? 0) + 1;
  return { ...prev, blockedUntil: new Date(now + restMs(strikes, retryAfterMs)).toISOString(), strikes, lastError: reason };
}

export const isResting = (h: Health | undefined, now: number) => !!h?.blockedUntil && Date.parse(h.blockedUntil) > now;

/** Retry-After as milliseconds: seconds or a date. */
export function parseRetryAfter(value: string | null | undefined, now = Date.now()): number | null {
  if (!value) return null;
  const secs = Number(value);
  if (Number.isFinite(secs) && secs >= 0) return secs * 1000;
  const at = Date.parse(value);
  return Number.isNaN(at) ? null : Math.max(0, at - now);
}

let warned = false;
const fallback = (what: string, err: string) => {
  if (!warned) console.warn(`[health] ${what} in Supabase failed (${err}); using the data folder. Run supabase/schema.sql to add the table.`);
  warned = true;
};

export async function loadHealth(): Promise<HealthMap> {
  const sb = getSupabase();
  if (sb) {
    const { data, error } = await sb.from("source_health").select("source,blocked_until,strikes,last_error,last_read_at");
    if (!error) {
      const out: HealthMap = {};
      for (const r of data as { source: string; blocked_until: string | null; strikes: number; last_error: string | null; last_read_at: string | null }[]) {
        out[r.source] = { blockedUntil: r.blocked_until, strikes: r.strikes ?? 0, lastError: r.last_error, lastReadAt: r.last_read_at };
      }
      return out;
    }
    fallback("reading source health", error.message);
  }
  return readHealthFile();
}

export async function saveHealth(source: string, health: Health): Promise<void> {
  const sb = getSupabase();
  if (sb) {
    const { error } = await sb.from("source_health").upsert({
      source,
      blocked_until: health.blockedUntil,
      strikes: health.strikes,
      last_error: health.lastError,
      last_read_at: health.lastReadAt ?? null,
      updated_at: new Date().toISOString(),
    });
    if (!error) return;
    fallback("saving source health", error.message);
  }
  const file: HealthFile = readHealthFile();
  file[source] = health;
  writeHealthFile(file);
}
