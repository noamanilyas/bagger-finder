/** When the next automatic scrape runs. Also used in the browser, so no server imports here. */
export type Schedule = { nextRunAt: string; intervalMinutes: number; quiet: QuietHours | null };

/** Machines stay listed for weeks: every 6 hours misses nothing and keeps the sites' limits far away. */
export const DEFAULT_INTERVAL_MINUTES = 360;

/** Hours without automatic scrapes, as "HH:MM" in German time (the sites are in Europe); "Refresh now" ignores them. */
export type QuietHours = { from: string; until: string };
export const DEFAULT_QUIET: QuietHours = { from: "22:00", until: "06:00" };
export const SCHEDULE_TIME_ZONE = "Europe/Berlin";

export const isClockTime = (v: unknown): v is string => typeof v === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(v);
const minutesOf = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));

/** Minutes since midnight at `ms` in German time. */
function localMinutes(ms: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: SCHEDULE_TIME_ZONE, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(ms);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get("hour") * 60 + get("minute");
}

/** Whether `ms` falls in the quiet hours. A window can run past midnight (22:00 to 06:00). */
export function inQuietHours(ms: number, quiet: QuietHours | null): boolean {
  if (!quiet || quiet.from === quiet.until) return false;
  const now = localMinutes(ms);
  const from = minutesOf(quiet.from);
  const until = minutesOf(quiet.until);
  return from < until ? now >= from && now < until : now >= from || now < until;
}

/**
 * The first moment at or after `ms` outside the quiet hours. On the nights the clocks change it can be an hour off,
 * which does not matter for a scrape.
 */
export function afterQuietHours(ms: number, quiet: QuietHours | null): number {
  if (!inQuietHours(ms, quiet)) return ms;
  const wait = (minutesOf(quiet!.until) - localMinutes(ms) + 1440) % 1440;
  const at = ms + wait * 60_000;
  return at - (at % 60_000); // on the minute
}

export const INTERVAL_CHOICES = [
  { minutes: 30, label: "30 minutes" },
  { minutes: 60, label: "1 hour" },
  { minutes: 120, label: "2 hours" },
  { minutes: 180, label: "3 hours" },
  { minutes: 360, label: "6 hours" },
  { minutes: 720, label: "12 hours" },
  { minutes: 1440, label: "24 hours" },
  { minutes: 2880, label: "48 hours" },
];

export const isIntervalChoice = (v: unknown): v is number => INTERVAL_CHOICES.some((c) => c.minutes === v);

/**
 * One interval after the latest scrape started, moved past the quiet hours. Nothing stored here: it follows from the last run,
 * so a restart neither postpones nor forgets it. No scrape yet means one is due now, and a scrape
 * that looks like it started in the future (a clock difference) counts as starting now.
 */
export function nextRun(lastStartMs: number | null, intervalMinutes: number, now = Date.now(), quiet: QuietHours | null = null): Schedule {
  let at = lastStartMs == null ? now : Math.min(lastStartMs, now) + intervalMinutes * 60_000;
  // A run due (or overdue) during the quiet hours waits for their end.
  const earliest = Math.max(at, now);
  if (inQuietHours(earliest, quiet)) at = afterQuietHours(earliest, quiet);
  return { nextRunAt: new Date(at).toISOString(), intervalMinutes, quiet };
}

/** 54:07 or 1:54:07. Rounds up, so it only reads 0:00 when the time has really come. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
