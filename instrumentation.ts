export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (process.env.AUTO_SCRAPE === "false") return;

  const { triggerScrape } = await import("./lib/trigger");
  setTimeout(() => triggerScrape("auto, after start"), 30_000);
  setInterval(() => triggerScrape("auto, every 6h"), 6 * 60 * 60_000);
}
