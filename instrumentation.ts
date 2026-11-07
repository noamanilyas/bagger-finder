export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs" && process.env.AUTO_SCRAPE !== "false") {
    const { triggerScrape } = await import("./lib/trigger");
    // No scrape on start: the first one runs after one full interval, then it repeats.
    const minutes = Math.max(5, Number(process.env.SCRAPE_INTERVAL_MINUTES) || 60);
    console.log(`[scheduler] scraping every ${minutes} min; first run in ${minutes} min (not at startup)`);
    setInterval(() => triggerScrape(`auto, every ${minutes} min`), minutes * 60_000);
  }
}
