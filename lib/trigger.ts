import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { readStatus, writeStatus } from "./store";

const STALE_MS = 30 * 60_000;
const MIN_GAP_MS = 3 * 60_000;

export function isRunning(): boolean {
  const s = readStatus();
  return s.running && !!s.startedAt && Date.now() - Date.parse(s.startedAt) < STALE_MS;
}

/** Start the Crawlee scraper as a separate process (keeps Chromium out of the web server). */
export function triggerScrape(reason: string): { started: boolean; reason?: string } {
  const s = readStatus();
  if (isRunning()) return { started: false, reason: "A scrape is already running." };
  if (s.startedAt && Date.now() - Date.parse(s.startedAt) < MIN_GAP_MS) {
    return { started: false, reason: "Last scrape started less than 3 minutes ago." };
  }

  writeStatus({
    ...s,
    running: true,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    message: `Starting (${reason})…`,
    sources: {},
  });

  const child = spawn(process.execPath, ["--import", "tsx", "scraper/run.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, CRAWLEE_STORAGE_DIR: path.join(os.tmpdir(), "crawlee") },
    stdio: "inherit",
  });

  child.on("exit", (code) => {
    if (code === 0) return;
    const cur = readStatus();
    if (cur.running) {
      writeStatus({
        ...cur,
        running: false,
        finishedAt: new Date().toISOString(),
        message: `Scraper stopped unexpectedly (exit code ${code}). Check the server logs.`,
      });
    }
  });

  return { started: true };
}
