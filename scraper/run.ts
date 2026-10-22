/**
 * Crawlee + Playwright scraper. Run with `npm run scrape` (or let the web app trigger it).
 *
 *   1. Crawlee opens each search page in headless Chromium (handles retries, rate limits, JS-rendered sites)
 *   2. we collect the "cards" around listing links from the DOM
 *   3. a free OpenRouter model turns the cards into structured listings (or a regex fallback without an API key)
 *   4. listings are filtered to the wanted models, geocoded and merged into data/listings.json
 */
import { PlaywrightCrawler } from "crawlee";
import crypto from "node:crypto";
import { SOURCES, WANTED, looksRelevant, matchModel } from "../lib/config";
import { readDb, readGeoCache, readStatus, writeDb, writeStatus } from "../lib/store";
import type { Listing, SourceResult, Status } from "../lib/types";
import { extract, hasAi, type Block, type Extracted } from "./extract";
import { geocode } from "./geocode";

const MAX_CARDS_PER_PAGE = 60;
const KEEP_DAYS = 14;

const status: Status = {
  ...readStatus(),
  running: true,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  message: "Crawling…",
  extractor: hasAi() ? "ai" : "heuristic",
  sources: {},
};
const save = (message?: string) => writeStatus({ ...status, message: message ?? status.message });

const collected: { source: string; sourceName: string; item: Extracted }[] = [];

function sourceStat(id: string): SourceResult {
  return (status.sources[id] ??= { ok: true, pages: 0, found: 0 });
}

function normalizeUrl(u: string): string {
  try {
    const url = new URL(u);
    url.hash = "";
    for (const k of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/.test(k)) url.searchParams.delete(k);
    return url.toString();
  } catch {
    return u;
  }
}

async function crawl() {
  const requests: { url: string; uniqueKey: string; userData: { source: string } }[] = [];
  const seen = new Set<string>();
  for (const s of SOURCES.filter((x) => x.enabled)) {
    for (const url of s.urls()) {
      if (seen.has(url)) continue;
      seen.add(url);
      requests.push({ url, uniqueKey: url, userData: { source: s.id } });
    }
  }

  const crawler = new PlaywrightCrawler({
    maxConcurrency: 1, // polite, and keeps memory low on small hosts
    maxRequestsPerMinute: 20,
    maxRequestRetries: 2,
    navigationTimeoutSecs: 45,
    requestHandlerTimeoutSecs: 120,
    launchContext: {
      launchOptions: { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] },
    },
    preNavigationHooks: [
      async ({ page }) => {
        // We only need text and links: skip images, fonts and media to save memory and bandwidth.
        await page.route("**/*", (route) =>
          ["image", "font", "media"].includes(route.request().resourceType()) ? route.abort() : route.continue(),
        );
      },
    ],
    async requestHandler({ page, request, log }) {
      const sourceId = String(request.userData.source);
      const source = SOURCES.find((s) => s.id === sourceId)!;
      const stat = sourceStat(sourceId);

      await page.waitForLoadState("domcontentloaded");
      // Dismiss cookie banners if there is one.
      for (const label of ["Alle akzeptieren", "Akzeptieren", "Zustimmen", "Accept all"]) {
        await page.getByRole("button", { name: label }).first().click({ timeout: 1200 }).catch(() => undefined);
      }
      await page.waitForTimeout(2000);
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(1000);

      const blocks: Block[] = await page.evaluate(() => {
        const best = new Map<string, { text: string; img: string | null }>();
        document.querySelectorAll("a[href]").forEach((a) => {
          const href = (a as HTMLAnchorElement).href;
          if (!/^https?:/.test(href) || href.split("#")[0] === location.href.split("#")[0]) return;
          let el: HTMLElement = a as HTMLElement;
          let text = el.innerText || "";
          let container: HTMLElement = el;
          for (let i = 0; i < 5 && el.parentElement; i++) {
            el = el.parentElement;
            const t = el.innerText || "";
            if (t.length > 800) break;
            text = t;
            container = el;
          }
          text = text.replace(/\s+/g, " ").trim();
          if (text.length < 25) return;
          const imgEl = container.querySelector("img");
          const img = imgEl ? imgEl.getAttribute("src") || imgEl.getAttribute("data-src") : null;
          const prev = best.get(href);
          if (!prev || text.length > prev.text.length) {
            best.set(href, { text: text.slice(0, 600), img: img ? new URL(img, location.href).toString() : null });
          }
        });
        return [...best].map(([href, v]) => ({ href, text: v.text, img: v.img }));
      });

      const relevant = blocks.filter((b) => looksRelevant(b.text)).slice(0, MAX_CARDS_PER_PAGE);
      const { items, via } = await extract(relevant, source.name);
      status.extractor = via;
      stat.pages += 1;
      stat.found += items.length;
      for (const item of items) collected.push({ source: sourceId, sourceName: source.name, item });
      log.info(`${source.name}: ${blocks.length} links, ${relevant.length} relevant, ${items.length} listings (${request.url})`);
      save(`Crawled ${source.name} (${stat.pages} pages)…`);
    },
    async failedRequestHandler({ request }, error) {
      const stat = sourceStat(String(request.userData.source));
      stat.ok = false;
      stat.error = (error as Error).message.split("\n")[0].slice(0, 200);
      console.warn(`[crawl] failed ${request.url}: ${stat.error}`);
      save();
    },
  });

  await crawler.run(requests);
}

async function merge() {
  save("Matching models and geocoding…");
  const now = new Date().toISOString();
  const db = readDb();
  const byId = new Map(db.listings.map((l) => [l.id, l]));
  const cache = readGeoCache();

  for (const { source, sourceName, item } of collected) {
    const text = [item.title, item.make, item.model, item.description].filter(Boolean).join(" ");
    const wanted = matchModel(`${item.title} ${item.make ?? ""} ${item.model ?? ""}`) ?? matchModel(text);
    if (!wanted) continue;

    const url = normalizeUrl(item.url);
    const id = crypto.createHash("sha1").update(url).digest("hex").slice(0, 16);
    const prev = byId.get(id);
    const sameLoc = prev && prev.location === item.location;
    const coords = sameLoc && prev.lat != null ? { lat: prev.lat, lng: prev.lng! } : await geocode(item.location, cache);

    const listing: Listing = {
      id,
      url,
      source: sourceName,
      title: item.title,
      description: item.description ?? "",
      make: item.make,
      model: item.model,
      modelKey: wanted.key,
      modelLabel: wanted.label,
      priceEur: item.priceEur,
      year: item.year,
      hours: item.hours,
      location: item.location,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      imageUrl: item.imageUrl,
      firstSeen: prev?.firstSeen ?? now,
      lastSeen: now,
    };
    byId.set(id, listing);
    void source;
  }

  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  const listings = [...byId.values()].filter((l) => Date.parse(l.lastSeen) >= cutoff);
  writeDb({ updatedAt: now, listings });
  return listings.length;
}

async function main() {
  console.log(`[scrape] start — extractor: ${hasAi() ? "OpenRouter free models" : "heuristic (no OPENROUTER_API_KEY)"}, models: ${WANTED.map((w) => w.label).join(", ")}`);
  save("Crawling…");
  try {
    await crawl();
    const total = await merge();
    const failed = Object.values(status.sources).filter((s) => !s.ok).length;
    status.running = false;
    status.finishedAt = new Date().toISOString();
    save(`Done: ${total} listings stored${failed ? ` (${failed} source(s) had errors)` : ""}.`);
    console.log(`[scrape] done — ${total} listings`);
  } catch (err) {
    status.running = false;
    status.finishedAt = new Date().toISOString();
    save(`Scrape failed: ${(err as Error).message}`);
    console.error(err);
    process.exitCode = 1;
  }
}

void main();
