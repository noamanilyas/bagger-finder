/** When the next automatic scrape runs. Also used in the browser, so no server imports here. */
export type Schedule = { nextRunAt: string; intervalMinutes: number };

export const DEFAULT_INTERVAL_MINUTES = 60;

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
 * One interval after the latest scrape started. Nothing stored here: it follows from the last run,
 * so a restart neither postpones nor forgets it. No scrape yet means one is due now, and a scrape
 * that looks like it started in the future (a clock difference) counts as starting now.
 */
export function nextRun(lastStartMs: number | null, intervalMinutes: number, now = Date.now()): Schedule {
  const at = lastStartMs == null ? now : Math.min(lastStartMs, now) + intervalMinutes * 60_000;
  return { nextRunAt: new Date(at).toISOString(), intervalMinutes };
}

/** 54:07 or 1:54:07. Rounds up, so it only reads 0:00 when the time has really come. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor(total / 60) % 60;
  const s = String(total % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}
