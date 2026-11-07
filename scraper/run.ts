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
import { CheerioCrawler, PlaywrightCrawler } from "crawlee";
import crypto from "node:crypto";
import { applyMarket, crossSiteDuplicates } from "../lib/market";
import { SOURCES, WANTED, isWheeled, looksRelevant, matchModel, scrapeLimits, withinLimits } from "../lib/config";
import { expandCountryCode, inEurope, isExcludedPlace } from "../lib/countries";
import { cookieLabels } from "../lib/languages";
import { hasSupabase, deleteOlderThan, finishRun, loadListings, recordHistory, saveListings } from "../lib/supabase";
import { DEFAULT_SETTINGS, loadSettings } from "../lib/settings";
import { readDb, readGeoCache, readStatus, writeDb, writeStatus } from "../lib/store";
import type { Listing, SourceResult, Status } from "../lib/types";
import { LAUNCH_OPTIONS, readCards, skipHeavyContent } from "./browser";
import { collectBlocksCheerio } from "./cards";
import { checkFlagged } from "./check";
import { extract, hasAi, heuristicItem, type Block, type Extracted } from "./extract";
import { geocode } from "./geocode";
import { isPhoto } from "./images";

const MAX_CARDS_PER_PAGE = 60;
const SAME_SITE_DELAY_SECS = 3;
const KEEP_DAYS = 14;
const FORCE_BROWSER = process.env.USE_BROWSER === "true";
/** Free models are limited: ads over this budget use the regex parser and get AI on a later scrape. */
const MAX_AI_CARDS_PER_RUN = 100;

const status: Status = {
  ...readStatus(),
  running: true,
  startedAt: new Date().toISOString(),
  finishedAt: null,
  message: "Crawling…",
  extractor: hasAi() ? "ai" : "heuristic",
  pagesDone: 0,
  pagesTotal: 0,
  sources: {},
};
const save = (message?: string) => {
  if (message) status.message = message;
  writeStatus({ ...status, lastActivity: new Date().toISOString() });
};

const collected: { source: string; sourceName: string; item: Extracted; cardHash: string; cardText: string }[] = [];

/** Listings stored by earlier scrapes: ads that did not change are not sent to AI again. */
let known = new Map<string, Listing>();
let settings = DEFAULT_SETTINGS;
const seenThisRun = new Set<string>();
const counts = { cards: 0, reused: 0, sentToAi: 0 };

type Job = { url: string; source: string };

function sourceStat(id: string): SourceResult {
  return (status.sources[id] ??= { ok: true, pages: 0, found: 0 });
}

const nameOf = (job: Job) => SOURCES.find((s) => s.id === job.source)?.name ?? job.source;

function startingPage(job: Job, how = "") {
  save(`Reading ${nameOf(job)}${how}…`);
}

function finishedPage() {
  status.pagesDone = (status.pagesDone ?? 0) + 1;
  save();
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

const listingId = (url: string) => crypto.createHash("sha1").update(normalizeUrl(url)).digest("hex").slice(0, 16);

/** Fingerprint of a card. Ignores "Heute, 12:30" style dates, which change without the ad changing. */
const cardHash = (text: string) =>
  crypto
    .createHash("sha1")
    .update(text.replace(/(?:Heute|Gestern),?\s*(?:\d{1,2}:\d{2})?/g, "").replace(/\s+/g, " ").trim().toLowerCase())
    .digest("hex")
    .slice(0, 16);

const fromKnown = (l: Listing, b: Block): Extracted => ({
  url: b.href,
  title: l.title,
  description: l.description,
  make: l.make,
  model: l.model,
  priceEur: l.priceEur,
  year: l.year,
  hours: l.hours,
  location: l.location,
  imageUrl: b.img ?? l.imageUrl,
  adType: l.adType,
  issues: l.issues,
  priceNote: l.priceNote,
});

/** Filters cards, runs extraction and stores the result. Returns the number of relevant cards. */
async function processBlocks(job: Job, blocks: Block[], info: (m: string) => void, countEmpty: boolean): Promise<number> {
  const source = SOURCES.find((s) => s.id === job.source)!;
  const stat = sourceStat(job.source);
  const relevant = blocks
    .filter((b) => looksRelevant(b.text) && (!source.isListing || source.isListing(b.href)))
    .slice(0, MAX_CARDS_PER_PAGE);
  if (relevant.length === 0) {
    if (countEmpty) stat.pages += 1;
    info(`${source.name}: ${blocks.length} links, 0 relevant (${job.url})`);
    return 0;
  }
  console.log(`[sample] ${source.name}: ${JSON.stringify(relevant.slice(0, 2).map((b) => b.text.slice(0, 320)))}`);
  save(`${source.name}: reading ${relevant.length} ads…`);

  // Only ads that can end up in the list and are new or changed go to AI.
  const limits = scrapeLimits();
  const items: Extracted[] = [];
  const forAi: Block[] = [];
  const byHref = new Map(relevant.map((b) => [b.href, b]));
  let aiLeft = MAX_AI_CARDS_PER_RUN - counts.sentToAi;
  for (const b of relevant) {
    const parsed = heuristicItem(b, source);
    if (!(matchModel(parsed.title, source.languages) ?? matchModel(b.text, source.languages)) || !withinLimits(parsed, limits)) continue;
    if (settings.mobileOnly && !isWheeled(`${parsed.title} ${b.text}`, parsed.title)) continue;
    const id = listingId(b.href);
    if (seenThisRun.has(id)) continue;
    seenThisRun.add(id);
    counts.cards++;
    const prev = known.get(id);
    if (prev && prev.adType && prev.cardHash === cardHash(b.text)) {
      items.push(fromKnown(prev, b));
      counts.reused++;
    } else if (hasAi() && aiLeft > 0 && source.ai !== false) {
      forAi.push(b);
      aiLeft--;
    } else {
      items.push(parsed);
    }
  }
  counts.sentToAi += forAi.length;
  const { items: extracted, via } = await extract(forAi, source);
  items.push(...extracted);
  if (forAi.length > 0) status.extractor = via;
  stat.pages += 1;
  stat.found += items.length;
  for (const item of items) {
    const text = byHref.get(item.url)?.text ?? "";
    collected.push({ source: job.source, sourceName: source.name, item, cardHash: cardHash(text), cardText: text });
  }
  info(`${source.name}: ${blocks.length} links, ${relevant.length} relevant, ${items.length} listings via ${via} (${job.url})`);
  return relevant.length;
}

const shortError = (e: unknown) => String((e as Error)?.message ?? e).split("\n")[0].slice(0, 200);

async function crawl() {
  const jobs: Job[] = [];
  const seen = new Set<string>();
  for (const s of SOURCES.filter((x) => x.enabled)) {
    for (const url of s.urls(settings.mobileOnly)) {
      if (seen.has(url)) continue;
      seen.add(url);
      jobs.push({ url, source: s.id });
    }
  }

  const browserOnly = (j: Job) => FORCE_BROWSER || SOURCES.find((s) => s.id === j.source)?.browser === true;
  const needBrowser: Job[] = jobs.filter(browserOnly);
  const httpJobs = jobs.filter((j) => !browserOnly(j));
  status.pagesTotal = httpJobs.length;
  const failed = new Map<string, string>(); // url -> last error

  // ---- phase 1: plain HTTP + Cheerio ---------------------------------------------------------
  if (httpJobs.length > 0) {
    const crawler = new CheerioCrawler({
      // The sites run side by side, but each one still gets at most one page every few seconds.
      maxConcurrency: SOURCES.filter((s) => s.enabled).length,
      sameDomainDelaySecs: SAME_SITE_DELAY_SECS,
      maxRequestRetries: 1,
      requestHandlerTimeoutSecs: 600, // may wait its turn for the AI (see scraper/extract.ts)
      async requestHandler({ $, request, log }) {
        const job: Job = { url: request.url, source: String(request.userData.source) };
        startingPage(job);
        const source = SOURCES.find((s) => s.id === job.source);
        const blocks = collectBlocksCheerio($, request.loadedUrl ?? request.url, source?.isListing, source?.spacedText);
        // A normal results page has dozens of links; if it has almost none it was probably rendered by
        // JavaScript (or blocked), so retry it in a real browser. Plenty of links but no match = no results.
        const looksEmpty = blocks.length < 15;
        const n = await processBlocks(job, blocks, (m) => log.info(m), !looksEmpty);
        if (n === 0 && looksEmpty) needBrowser.push(job);
        finishedPage();
      },
      async failedRequestHandler({ request }, error) {
        const job: Job = { url: request.url, source: String(request.userData.source) };
        failed.set(job.url, shortError(error));
        needBrowser.push(job);
        finishedPage();
        console.warn(`[crawl] http fetch failed ${request.url}: ${shortError(error)}`);
      },
    });
    save("Fetching pages…");
    await crawler.run(httpJobs.map((j) => ({ url: j.url, uniqueKey: `${j.url}#http`, userData: { source: j.source } })));
  }

  // ---- phase 2: headless Chromium, only for pages that need it -------------------------------
  if (needBrowser.length > 0) {
    status.pagesTotal = (status.pagesTotal ?? 0) + needBrowser.length;
    save(`Opening ${needBrowser.length} page(s) in a browser…`);
    const crawler = new PlaywrightCrawler({
      maxConcurrency: 1, // polite, and keeps memory low on small hosts
      maxRequestsPerMinute: 20,
      maxRequestRetries: 2,
      navigationTimeoutSecs: 45,
      requestHandlerTimeoutSecs: 300,
      launchContext: { launchOptions: LAUNCH_OPTIONS },
      preNavigationHooks: [skipHeavyContent],
      async requestHandler({ page, request, log }) {
        const job: Job = { url: request.url, source: String(request.userData.source) };
        startingPage(job, " in a browser");
        const source = SOURCES.find((s) => s.id === job.source);
        const blocks = await readCards(page, cookieLabels(source?.languages ?? []), source?.isListing);
        await processBlocks(job, blocks, (m) => log.info(m), true);
        failed.delete(job.url); // the browser got through
        finishedPage();
      },
      async failedRequestHandler({ request }, error) {
        failed.set(request.url, shortError(error));
        finishedPage();
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
  const byId = new Map(known);
  const cache = readGeoCache();
  const limits = scrapeLimits();
  console.log(`[scrape] limits: max price ${limits.maxPrice ?? "none"}, max year ${limits.maxYear ?? "none"}`);

  for (const [i, { source: sourceId, sourceName, item, cardHash: hash, cardText }] of collected.entries()) {
    if (i % 25 === 0) save(`Matching models and finding map locations: ${i + 1} of ${collected.length} ads…`);
    const source = SOURCES.find((s) => s.id === sourceId)!;
    const text = [item.title, item.make, item.model, item.description].filter(Boolean).join(" ");
    const wanted =
      matchModel(`${item.title} ${item.make ?? ""} ${item.model ?? ""}`, source.languages) ??
      matchModel(text, source.languages) ??
      // AI may summarise the word for excavator away ("Hyundai R140W"), although the card passed this same check.
      matchModel(cardText, source.languages);
    if (!wanted) continue;
    if (!withinLimits(item, limits)) continue;
    const location = source.countryCodes ? expandCountryCode(item.location) : item.location;
    if (isExcludedPlace(location)) continue;

    const url = normalizeUrl(item.url);
    const id = listingId(url);
    const prev = byId.get(id);
    const sameLoc = prev && prev.location === location;
    const coords = sameLoc && prev.lat != null ? { lat: prev.lat, lng: prev.lng! } : await geocode(location, cache, source.defaultCountry);
    if (coords && !inEurope(coords)) continue;

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
      wheeled: false, // set below for every stored listing
      priceEur: item.priceEur,
      year: item.year,
      hours: item.hours,
      location,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null,
      imageUrl: item.imageUrl ?? prev?.imageUrl ?? null,
      firstSeen: prev?.firstSeen ?? now,
      lastSeen: now,
      cardHash: hash,
      cardText,
      adType: item.adType,
      issues: item.issues,
      priceNote: item.priceNote,
      marketMedian: null, // set by applyMarket below
      marketCount: null,
      belowPct: null,
      flagged: false,
      aiVerdict: prev?.aiVerdict ?? null,
      aiReason: prev?.aiReason ?? null,
      aiModel: prev?.aiModel ?? null,
      aiCheckKey: prev?.aiCheckKey ?? null,
    };
    byId.set(id, listing);
  }

  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  // Recomputed for all rows, so stored listings the sites did not show this time are corrected too.
  const kept = [...byId.values()]
    .filter((l) => Date.parse(l.lastSeen) >= cutoff)
    .map((l) => ({
      ...l,
      wheeled: isWheeled([l.title, l.make, l.model, l.description, l.cardText].filter(Boolean).join(" "), l.title),
      // Clears placeholders, logos and flags stored by earlier scrapes, also on ads the sites did not show this time.
      imageUrl: l.imageUrl && isPhoto(l.imageUrl) ? l.imageUrl : null,
    }));
  const listings = applyMarket(kept);
  const duplicates = crossSiteDuplicates(listings);
  console.log(`[scrape] on more than one site: ${duplicates.machines} machines, ${duplicates.extraAds} extra ads`);
  save("Checking machines priced well below similar ones…");
  const review = await checkFlagged(listings);
  console.log(
    `[scrape] AI use: ${counts.cards} matching ads, ${counts.reused} unchanged, ${counts.sentToAi} sent to AI; ` +
      `${review.flagged} flagged, ${review.checked} reviewed, ${review.failed} review failures, ${review.waiting} waiting`,
  );
  save(`Saving ${listings.length} listings…`);
  if (hasSupabase()) {
    await saveListings(listings);
    await deleteOlderThan(new Date(cutoff).toISOString());
    // A history problem must not fail the scrape: unrecorded changes are picked up on the next one.
    try {
      const h = await recordHistory(listings, now);
      console.log(`[scrape] history: ${h.added} rows added, ${h.touched} unchanged, ${h.removed} non-sale removed`);
    } catch (err) {
      console.warn(`[scrape] history not recorded: ${(err as Error).message}`);
    }
  }
  writeDb({ updatedAt: now, listings }); // local copy / fallback
  return listings.length;
}

/** Set by the web server so this run can be closed in the scrape_runs table. */
const runId = Number(process.env.SCRAPE_RUN_ID) || null;

async function main() {
  console.log(
    `[scrape] start — extractor: ${hasAi() ? "AI (hybrid: Gemini, Groq, free OpenRouter)" : "heuristic (no AI key)"}, models: ${WANTED.map((w) => w.label).join(", ")}`,
  );
  save("Crawling…");
  try {
    settings = await loadSettings();
    console.log(`[scrape] settings: ${settings.mobileOnly ? "Mobilbagger only" : "all excavator types"}`);
    known = new Map((hasSupabase() ? await loadListings() : readDb().listings).map((l) => [l.id, l]));
    await crawl();
    const total = await merge();
    const failed = Object.values(status.sources).filter((s) => !s.ok).length;
    status.running = false;
    status.finishedAt = new Date().toISOString();
    save(`Done: ${total} listings stored${failed ? ` (${failed} source(s) had errors)` : ""}.`);
    console.log(`[scrape] done — ${total} listings`);
    if (runId) await finishRun(runId, { status: "done", listings: total, message: status.message });
  } catch (err) {
    status.running = false;
    status.finishedAt = new Date().toISOString();
    save(`Scrape failed: ${(err as Error).message}`);
    console.error(err);
    process.exitCode = 1;
    if (runId) await finishRun(runId, { status: "failed", message: status.message });
  }
}

void main();
