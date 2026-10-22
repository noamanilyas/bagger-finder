/**
 * Crawlee scraper. Run with `npm run scrape` (or let the web app trigger it).
 *
 *   1. CheerioCrawler fetches each search page over plain HTTP (cheap: no browser, little memory)
 *   2. pages that come back empty or blocked are retried in headless Chromium (PlaywrightCrawler) —
 *      Chromium is only started if at least one page needs it
 *   3. the "cards" around listing links are collected, and a free OpenRouter model turns them into
 *      structured listings (regex fallback without an API key / when the models fail)
 *   4. listings are filtered to the wanted models, geocoded and merged into data/listings.json
 */
import { CheerioCrawler, PlaywrightCrawler, type CheerioRoot } from "crawlee";
import crypto from "node:crypto";
import { SOURCES, WANTED, looksRelevant, matchModel } from "../lib/config";
import { readDb, readGeoCache, readStatus, writeDb, writeStatus } from "../lib/store";
import type { Listing, SourceResult, Status } from "../lib/types";
import { extract, hasAi, type Block, type Extracted } from "./extract";
import { geocode } from "./geocode";

const MAX_CARDS_PER_PAGE = 60;
const KEEP_DAYS = 14;
const FORCE_BROWSER = process.env.USE_BROWSER === "true";

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

type Job = { url: string; source: string };

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

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** Cards from server-rendered HTML: for every link, the largest small ancestor's text. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CheerioNode = any; // cheerio's generic node types are not worth the ceremony here

function collectBlocksCheerio($: CheerioRoot, pageUrl: string): Block[] {
  const best = new Map<string, Block>();
  const textOf = (n: CheerioNode): string => clean($(n).clone().find("script,style,noscript").remove().end().text());
  $("a[href]").each((_: number, a: CheerioNode) => {
    const raw = $(a).attr("href");
    if (!raw || /^(javascript:|mailto:|tel:|#)/i.test(raw)) return;
    let href: string;
    try {
      href = new URL(raw, pageUrl).toString();
    } catch {
      return;
    }
    if (!/^https?:/.test(href) || href.split("#")[0] === pageUrl.split("#")[0]) return;

    let container: CheerioNode = a;
    let text = textOf(a);
    for (const parent of $(a).parents().toArray().slice(0, 5) as CheerioNode[]) {
      const t = textOf(parent);
      if (t.length > 800) break;
      container = parent;
      text = t;
    }
    if (text.length < 25) return;
    const imgEl = $(container).find("img").first();
    const src = imgEl.attr("src") || imgEl.attr("data-src") || null;
    let img: string | null = null;
    try {
      img = src ? new URL(src, pageUrl).toString() : null;
    } catch {
      img = null;
    }
    const prev = best.get(href);
    if (!prev || text.length > prev.text.length) best.set(href, { href, text: text.slice(0, 600), img });
  });
  return [...best.values()];
}

/** Filters cards, runs extraction and stores the result. Returns the number of relevant cards. */
async function processBlocks(job: Job, blocks: Block[], info: (m: string) => void, countEmpty: boolean): Promise<number> {
  const source = SOURCES.find((s) => s.id === job.source)!;
  const stat = sourceStat(job.source);
  const relevant = blocks.filter((b) => looksRelevant(b.text)).slice(0, MAX_CARDS_PER_PAGE);
  if (relevant.length === 0) {
    if (countEmpty) stat.pages += 1;
    info(`${source.name}: ${blocks.length} links, 0 relevant (${job.url})`);
    return 0;
  }
  const { items, via } = await extract(relevant, source.name);
  status.extractor = via;
  stat.pages += 1;
  stat.found += items.length;
  for (const item of items) collected.push({ source: job.source, sourceName: source.name, item });
  info(`${source.name}: ${blocks.length} links, ${relevant.length} relevant, ${items.length} listings via ${via} (${job.url})`);
  save(`Crawled ${source.name} (${stat.pages} pages)…`);
  return relevant.length;
}

const shortError = (e: unknown) => String((e as Error)?.message ?? e).split("\n")[0].slice(0, 200);

async function crawl() {
  const jobs: Job[] = [];
  const seen = new Set<string>();
  for (const s of SOURCES.filter((x) => x.enabled)) {
    for (const url of s.urls()) {
      if (seen.has(url)) continue;
      seen.add(url);
      jobs.push({ url, source: s.id });
    }
  }

  const needBrowser: Job[] = FORCE_BROWSER ? [...jobs] : [];
  const failed = new Map<string, string>(); // url -> last error

  // ---- phase 1: plain HTTP + Cheerio ---------------------------------------------------------
  if (!FORCE_BROWSER) {
    const crawler = new CheerioCrawler({
      maxConcurrency: 1,
      maxRequestsPerMinute: 20,
      maxRequestRetries: 1,
      requestHandlerTimeoutSecs: 300,
      async requestHandler({ $, request, log }) {
        const job: Job = { url: request.url, source: String(request.userData.source) };
        const blocks = collectBlocksCheerio($, request.loadedUrl ?? request.url);
        const n = await processBlocks(job, blocks, (m) => log.info(m), false);
        if (n === 0) needBrowser.push(job); // maybe rendered by JavaScript: retry in a real browser
      },
      async failedRequestHandler({ request }, error) {
        const job: Job = { url: request.url, source: String(request.userData.source) };
        failed.set(job.url, shortError(error));
        needBrowser.push(job);
        console.warn(`[crawl] http fetch failed ${request.url}: ${shortError(error)}`);
      },
    });
    save("Fetching pages…");
    await crawler.run(jobs.map((j) => ({ url: j.url, uniqueKey: `${j.url}#http`, userData: { source: j.source } })));
  }

  // ---- phase 2: headless Chromium, only for pages that need it -------------------------------
  if (needBrowser.length > 0) {
    save(`Opening ${needBrowser.length} page(s) in a browser…`);
    const crawler = new PlaywrightCrawler({
      maxConcurrency: 1, // polite, and keeps memory low on small hosts
      maxRequestsPerMinute: 20,
      maxRequestRetries: 2,
      navigationTimeoutSecs: 45,
      requestHandlerTimeoutSecs: 300,
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
        const job: Job = { url: request.url, source: String(request.userData.source) };

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

        await processBlocks(job, blocks, (m) => log.info(m), true);
        failed.delete(job.url); // the browser got through
      },
      async failedRequestHandler({ request }, error) {
        failed.set(request.url, shortError(error));
        console.warn(`[crawl] browser failed ${request.url}: ${shortError(error)}`);
      },
    });
    await crawler.run(needBrowser.map((j) => ({ url: j.url, uniqueKey: `${j.url}#browser`, userData: { source: j.source } })));
  }

  // pages that failed in both phases count as source errors
  for (const [url, error] of failed) {
    const job = jobs.find((j) => j.url === url);
    if (!job) continue;
    const stat = sourceStat(job.source);
    stat.ok = false;
    stat.error ??= error;
  }
}

async function merge() {
  save("Matching models and geocoding…");
  const now = new Date().toISOString();
  const db = readDb();
  const byId = new Map(db.listings.map((l) => [l.id, l]));
  const cache = readGeoCache();

  for (const { sourceName, item } of collected) {
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
  }

  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  const listings = [...byId.values()].filter((l) => Date.parse(l.lastSeen) >= cutoff);
  writeDb({ updatedAt: now, listings });
  return listings.length;
}

async function main() {
  console.log(
    `[scrape] start — extractor: ${hasAi() ? "OpenRouter free models" : "heuristic (no OPENROUTER_API_KEY)"}, models: ${WANTED.map((w) => w.label).join(", ")}`,
  );
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
