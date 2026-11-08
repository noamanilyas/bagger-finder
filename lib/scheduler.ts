import { nextRun, type Schedule } from "./schedule";
import { DEFAULT_SETTINGS, loadSettings, type ScraperSettings } from "./settings";
import { readStatus } from "./store";
import { closeStaleRuns, lastRunStartedAt } from "./supabase";
import { triggerScrape } from "./trigger";

const CHECK_EVERY_MS = 15_000;
/** A scrape still marked running after this long belongs to a server that died. */
const INTERRUPTED_AFTER_MS = 30 * 60_000;

async function settings(): Promise<ScraperSettings> {
  try {
    return await loadSettings();
  } catch (e) {
    console.warn(`[scheduler] ${(e as Error).message}: using the default schedule`);
    return DEFAULT_SETTINGS;
  }
}

/**
 * When the latest scrape started: the newest of the database and this server's status file. The
 * database survives restarts and redeploys; the file still covers a database that cannot be read,
 * so an outage does not turn into a scrape every 15 seconds.
 */
async function lastStartMs(): Promise<number | null> {
  const times: number[] = [];
  const local = readStatus().startedAt;
  if (local) times.push(Date.parse(local));
  const db = await lastRunStartedAt();
  if (db) times.push(Date.parse(db));
  return times.length ? Math.max(...times) : null;
}

/** null when automatic scraping is switched off. */
export async function getSchedule(): Promise<Schedule | null> {
  if (process.env.AUTO_SCRAPE === "false") return null;
  const { intervalMinutes, quiet } = await settings();
  return nextRun(await lastStartMs(), intervalMinutes, Date.now(), quiet);
}

/** Runs in the web server: scrapes whenever the next time has come, including right at startup if it was missed. */
export async function startScheduler() {
  await closeStaleRuns(new Date(Date.now() - INTERRUPTED_AFTER_MS).toISOString());
  const first = await getSchedule();
  if (first) {
    const left = Date.parse(first.nextRunAt) - Date.now();
    console.log(
      `[scheduler] scraping every ${first.intervalMinutes} min${first.quiet ? `, not from ${first.quiet.from} to ${first.quiet.until} German time` : ""}; ` +
        (left > 0 ? `next in ${Math.ceil(left / 60_000)} min` : "the last scrape is overdue, scraping now"),
    );
  }

  let busy = false;
  let lastSkip = "";
  const tick = async () => {
    if (busy) return;
    busy = true;
    try {
      const schedule = await getSchedule();
      if (!schedule || Date.now() < Date.parse(schedule.nextRunAt)) return;
      const result = await triggerScrape(`auto, every ${schedule.intervalMinutes} min`, undefined, "auto");
      if (result.started) lastSkip = "";
      else if (result.reason !== lastSkip) {
        lastSkip = result.reason ?? "";
        console.log(`[scheduler] due, but skipped: ${lastSkip}`);
      }
    } catch (e) {
      console.warn(`[scheduler] ${(e as Error).message}`);
    } finally {
      busy = false;
    }
  };
  void tick();
  setInterval(() => void tick(), CHECK_EVERY_MS);
}
