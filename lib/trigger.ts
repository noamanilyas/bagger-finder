import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import type { Limits } from "./config";
import { finishRun, startRun } from "./supabase";
import { readStatus, writeStatus } from "./store";

/** No progress for this long means the scraper died or hung, so a new scrape may start. */
const STALE_MS = 10 * 60_000;
const MIN_GAP_MS = 3 * 60_000;

export function isRunning(): boolean {
  const s = readStatus();
  const last = s.lastActivity ?? s.startedAt;
  return s.running && !!last && Date.now() - Date.parse(last) < STALE_MS;
}

/** Start the Crawlee scraper as a separate process (keeps Chromium out of the web server). */
export async function triggerScrape(
  reason: string,
  limits?: Limits,
  trigger: "auto" | "manual" = "manual",
): Promise<{ started: boolean; reason?: string }> {
  const s = readStatus();
  if (isRunning()) return { started: false, reason: "A scrape is already running." };
  if (s.startedAt && Date.now() - Date.parse(s.startedAt) < MIN_GAP_MS) {
    return { started: false, reason: "Last scrape started less than 3 minutes ago." };
  }

  // Taken before any await, so a second call arriving meanwhile is refused above.
  const startedAt = new Date().toISOString();
  writeStatus({
    ...s,
    running: true,
    startedAt,
    finishedAt: null,
    message: `Starting (${reason})…`,
    pagesDone: 0,
    pagesTotal: 0,
    lastActivity: new Date().toISOString(),
    sources: {},
  });

  const runId = await startRun(trigger, startedAt);

  const child = spawn(process.execPath, ["--import", "tsx", "scraper/run.ts"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ...(limits ? { SCRAPE_MAX_PRICE: String(limits.maxPrice ?? ""), SCRAPE_MAX_YEAR: String(limits.maxYear ?? "") } : {}),
      ...(runId ? { SCRAPE_RUN_ID: String(runId) } : {}),
      // Automatic runs read only the sites that are due (lib/site-schedule.ts); "Refresh now" reads them all.
      SCRAPE_TRIGGER: trigger,
      CRAWLEE_STORAGE_DIR: path.join(os.tmpdir(), "crawlee"),
      // Crawlee misdetects the container's memory limit as 128 MB and logs false "overloaded" warnings
      CRAWLEE_MEMORY_MBYTES: process.env.CRAWLEE_MEMORY_MBYTES || "1024",
    },
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    if (code === 0) return;
    const message = `Scraper stopped unexpectedly (exit code ${code}). Check the server logs.`;
    const cur = readStatus();
    if (cur.running) writeStatus({ ...cur, running: false, finishedAt: new Date().toISOString(), message });
    if (runId) void finishRun(runId, { status: "failed", message });
  });

  return { started: true };
}
