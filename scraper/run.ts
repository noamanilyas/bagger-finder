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
import { CheerioCrawler, Configuration, PlaywrightCrawler } from "crawlee";
import crypto from "node:crypto";
import { applyMarket, crossSiteDuplicates } from "../lib/market";
import { SOURCES, WANTED, fitsMobileOnly, isWheeled, looksRelevant, matchModel, scrapeLimits, withinLimits, type PagedSearch, type Source } from "../lib/config";
import { setEurRates, toEur } from "../lib/currency";
import { loadEurRates } from "../lib/fx";
import { hoursFor, isSiteDue, nextSiteRead } from "../lib/site-schedule";
import { afterBlock, isResting, loadHealth, parseRetryAfter, saveHealth, type HealthMap } from "../lib/source-health";
import { expandCountryCode, inEurope, isExcludedPlace } from "../lib/countries";
import { cookieLabels } from "../lib/languages";
import { hasSupabase, deleteListings, deleteOlderThan, finishRun, loadListings, recordHistory, saveListings } from "../lib/supabase";
import { DEFAULT_SETTINGS, loadSettings } from "../lib/settings";
import { readDb, readGeoCache, readStatus, writeDb, writeStatus } from "../lib/store";
import type { Listing, SourceResult, Status } from "../lib/types";
import { blockReason } from "./blocks";
import { LAUNCH_OPTIONS, readCards, skipHeavyContent } from "./browser";
import { collectBlocksCheerio, withoutTracking } from "./cards";
import { checkFlagged } from "./check";
import { extract, hasAi, heuristicItem, type Block, type Extracted } from "./extract";
import { geocode, geocodeUsage } from "./geocode";
import { isPhoto } from "./images";
import { fetchMobileDe, hasMobileDeAccess } from "./mobile-de-api";
import { robotsFor } from "./robots";

const MAX_CARDS_PER_PAGE = 60;
const SAME_SITE_DELAY_SECS = 3;
/** A Crawl-delay above this is taken as this: one page every 30 s still finishes a site's searches in a run. */
const MAX_DELAY_SECS = 30;
/** Sites read side by side. Each one still gets one page at a time, with its own delay. */
const SITES_AT_ONCE = 6;
const KEEP_DAYS = 3;
const FORCE_BROWSER = process.env.USE_BROWSER === "true";
/** For trying sites out: SCRAPE_SOURCES=otomoto,finn reads only those. Unset in normal runs. */
const ONLY = process.env.SCRAPE_SOURCES?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
/** Automatic runs read only the sites that are due; "Refresh now" and runs from the command line read every site. */
const AUTOMATIC = process.env.SCRAPE_TRIGGER === "auto";

/** Skipped by this automatic run because the site is read less often: says until when. */
function notDue(source: Source, now: number): string | null {
  if (!AUTOMATIC) return null;
  const hours = hoursFor(settings.siteHours, source.id);
  const lastReadAt = health[source.id]?.lastReadAt;
  return isSiteDue(lastReadAt, hours, now) ? null : nextSiteRead(lastReadAt, hours);
}

/** Notes that a site was read, so its next automatic read can be timed. */
async function markRead(source: Source, startedAt: string) {
  const next = { ...(health[source.id] ?? { blockedUntil: null, strikes: 0, lastError: null }), lastReadAt: startedAt };
  // A site read without a block starts with a clean record again.
  if (!blockedThisRun.has(source.id)) Object.assign(next, { blockedUntil: null, strikes: 0, lastError: null });
  health[source.id] = next;
  await saveHealth(source.id, next).catch((e) => console.warn(`[health] ${source.name}: ${(e as Error).message}`));
}
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

/** coords: given by an API, so the place need not be looked up */
const collected: { source: string; sourceName: string; item: Extracted; cardHash: string; cardText: string; coords?: { lat: number; lng: number } }[] = [];

/** Listings stored by earlier scrapes: ads that did not change are not sent to AI again. */
let known = new Map<string, Listing>();
let settings = DEFAULT_SETTINGS;
const seenThisRun = new Set<string>();
const counts = { cards: 0, reused: 0, sentToAi: 0 };

/** search and page: set for a paged search (Source.paged), so the next page can follow */
type Job = { url: string; source: string; search?: number; page?: number };

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

const fromKnown = (l: Listing, b: Block, parsed: Extracted): Extracted => ({
  url: b.href,
  title: l.title,
  description: l.description,
  make: l.make,
  model: l.model,
  // A price in another currency is worked out again from today's rate.
  priceEur: l.priceCurrency ? toEur(l.priceAmount ?? null, l.priceCurrency) : l.priceEur,
  priceAmount: l.priceAmount ?? null,
  priceCurrency: l.priceCurrency ?? null,
  year: l.year,
  hours: l.hours,
  location: l.location ?? parsed.location, // an unchanged card must not keep a place that was missed the first time
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
    const model = matchModel(parsed.title, source.languages) ?? matchModel(b.text, source.languages);
    if (!model || !withinLimits(parsed, limits, model)) continue;
    if (settings.mobileOnly && !fitsMobileOnly(model, `${parsed.title} ${b.text}`, parsed.title)) continue;
    const id = listingId(b.href);
    if (seenThisRun.has(id)) continue;
    seenThisRun.add(id);
    counts.cards++;
    const prev = known.get(id);
    if (prev && prev.adType && prev.cardHash === cardHash(b.text)) {
      items.push(fromKnown(prev, b, parsed));
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

const sourceOf = (job: Job) => SOURCES.find((s) => s.id === job.source)!;

/** Sites that refused during this run: none of their pages are read again, in either phase. */
const blockedThisRun = new Set<string>();
let health: HealthMap = {};

async function block(source: Source, reason: string, retryAfter: string | null | undefined) {
  if (blockedThisRun.has(source.id)) return;
  blockedThisRun.add(source.id);
  const stat = sourceStat(source.id);
  stat.ok = false;
  stat.blocked = reason;
  stat.error = reason;
  const next = afterBlock(health[source.id], reason, Date.now(), parseRetryAfter(retryAfter));
  health[source.id] = next;
  console.warn(`[crawl] ${source.name} ${reason}: no more pages this run; resting until ${next.blockedUntil}`);
  await saveHealth(source.id, next).catch((e) => console.warn(`[health] ${source.name}: ${(e as Error).message}`));
}

/** Ads already seen per paged search: a page that shows nothing new ends the search (some sites repeat the last page). */
const seenPerSearch = new Map<string, Set<string>>();
const searchesOf = new Map<string, PagedSearch[]>();

/** The next page of a paged search, if this one had new ads and robots.txt allows it. */
async function nextPage(job: Job, blocks: Block[]): Promise<Job | null> {
  if (job.search == null || job.page == null) return null;
  const search = searchesOf.get(job.source)?.[job.search];
  if (!search || job.page >= search.maxPages) return null;
  const source = sourceOf(job);
  const key = `${job.source}#${job.search}`;
  const seen = seenPerSearch.get(key) ?? new Set<string>();
  seenPerSearch.set(key, seen);
  let fresh = 0;
  for (const b of blocks) {
    if (source.isListing && !source.isListing(b.href)) continue;
    if (!seen.has(b.href)) fresh++;
    seen.add(b.href);
  }
  if (fresh === 0) return null;
  const url = search.page(job.page + 1);
  if (!(await robotsFor(url)).allowed(url)) return null;
  return { url, source: job.source, search: job.search, page: job.page + 1 };
}

const asRequest = (j: Job, phase: "http" | "browser") => ({
  url: j.url,
  uniqueKey: `${j.url}#${phase}`,
  userData: { source: j.source, search: j.search, page: j.page },
});
const jobOf = (r: { url: string; userData: Record<string, unknown> }): Job => ({
  url: r.url,
  source: String(r.userData.source),
  search: typeof r.userData.search === "number" ? r.userData.search : undefined,
  page: typeof r.userData.page === "number" ? r.userData.page : undefined,
});

/** First pages of every search of a source, without the ones robots.txt disallows. Also returns the delay to keep. */
async function plan(source: Source, seen: Set<string>): Promise<{ jobs: Job[]; delaySecs: number }> {
  const searches = source.paged?.(settings.mobileOnly) ?? [];
  searchesOf.set(source.id, searches);
  const start: Job[] = [
    ...(source.urls?.(settings.mobileOnly) ?? []).map((url) => ({ url, source: source.id })),
    ...searches.map((s, i) => ({ url: s.page(1), source: source.id, search: i, page: 1 })),
  ];
  const jobs: Job[] = [];
  let delaySecs = source.delaySecs ?? SAME_SITE_DELAY_SECS;
  for (const job of start) {
    if (seen.has(job.url)) continue;
    seen.add(job.url);
    const rules = await robotsFor(job.url);
    if (rules.note) console.log(`[robots] ${source.name}: ${rules.note}`);
    if (!rules.allowed(job.url)) {
      console.warn(`[robots] ${source.name}: robots.txt disallows ${job.url}, not read`);
      continue;
    }
    if (rules.crawlDelaySecs) delaySecs = Math.max(delaySecs, Math.min(rules.crawlDelaySecs, MAX_DELAY_SECS));
    jobs.push(job);
  }
  return { jobs, delaySecs };
}

/** Runs tasks with at most `limit` at a time. */
async function inParallel<T>(items: T[], limit: number, task: (item: T) => Promise<void>) {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) await task(items[next++]);
    }),
  );
}

async function crawl() {
  health = await loadHealth();
  const now = Date.now();
  const seen = new Set<string>();
  const plans: { source: Source; jobs: Job[]; delaySecs: number }[] = [];
  for (const s of SOURCES.filter((x) => x.enabled && !x.api && (!ONLY || ONLY.includes(x.id)))) {
    const h = health[s.id];
    if (isResting(h, now)) {
      sourceStat(s.id).restingUntil = h!.blockedUntil!;
      console.log(`[crawl] ${s.name} is resting after a block until ${h!.blockedUntil} (${h!.lastError}): skipped`);
      continue;
    }
    const until = notDue(s, now);
    if (until) {
      sourceStat(s.id).notDueUntil = until;
      console.log(`[crawl] ${s.name} is read every ${hoursFor(settings.siteHours, s.id)} h (scraper settings): next due ${until}, skipped`);
      continue;
    }
    plans.push({ source: s, ...(await plan(s, seen)) });
  }

  const browserOnly = (s: Source) => FORCE_BROWSER || s.browser === true;
  const needBrowser: Job[] = plans.filter((p) => browserOnly(p.source)).flatMap((p) => p.jobs);
  const httpPlans = plans.filter((p) => !browserOnly(p.source) && p.jobs.length > 0);
  status.pagesTotal = httpPlans.reduce((n, p) => n + p.jobs.length, 0);
  const failed = new Map<string, { source: string; error: string }>(); // url -> last error
  const fail = (job: Job, error: string) => failed.set(job.url, { source: job.source, error });
  const retryInBrowser = (job: Job) => !blockedThisRun.has(job.source) && sourceOf(job).browserFallback !== false;

  // ---- phase 1: plain HTTP + Cheerio, one crawler per site so each keeps its own pace ----------
  save("Fetching pages…");
  await inParallel(httpPlans, SITES_AT_ONCE, async ({ source, jobs, delaySecs }) => {
    const crawler = new CheerioCrawler(
      {
        maxConcurrency: 1,
        sameDomainDelaySecs: delaySecs,
        maxRequestRetries: 1,
        requestHandlerTimeoutSecs: 600, // may wait its turn for the AI (see scraper/extract.ts)
        // Refusals reach the handler instead of being retried, so the site can be left alone at once.
        ignoreHttpErrorStatusCodes: [401, 403, 429, 503],
        sessionPoolOptions: { blockedStatusCodes: [] },
        async requestHandler({ $, request, log, response, crawler: self }) {
          const job = jobOf(request);
          if (blockedThisRun.has(source.id)) return finishedPage();
          startingPage(job);
          const reason = blockReason(response.statusCode ?? 0, $("title").first().text());
          if (reason) {
            await block(source, reason, response.headers["retry-after"] as string | undefined);
            finishedPage();
            await self.autoscaledPool?.abort();
            return;
          }
          if (response.statusCode === 503) {
            fail(job, "HTTP 503");
            return finishedPage();
          }
          // A 404 page still has menu links, so without this a dead search address looks like "no results".
          if (response.statusCode === 404) log.warning(`Page not found (404), check this address in lib/config.ts: ${request.url}`);
          const blocks = withoutTracking(collectBlocksCheerio($, request.loadedUrl ?? request.url, source.isListing, source.spacedText, source.cardChars), source.stripQuery);
          // A normal results page has dozens of links; if it has almost none it was probably rendered by
          // JavaScript, so retry it in a real browser. Plenty of links but no match = no results.
          const looksEmpty = blocks.length < 15;
          const n = await processBlocks(job, blocks, (m) => log.info(m), !looksEmpty);
          if (n === 0 && looksEmpty && retryInBrowser(job)) needBrowser.push(job);
          const next = await nextPage(job, blocks);
          if (next) {
            status.pagesTotal = (status.pagesTotal ?? 0) + 1;
            await self.addRequests([asRequest(next, "http")]);
          }
          finishedPage();
        },
        async failedRequestHandler({ request }, error) {
          const job = jobOf(request);
          fail(job, shortError(error));
          if (retryInBrowser(job)) needBrowser.push(job);
          finishedPage();
          console.warn(`[crawl] http fetch failed ${request.url}: ${shortError(error)}`);
        },
      },
      // In memory, and separate per site: each crawler has its own queue.
      new Configuration({ persistStorage: false }),
    );
    await crawler.run(jobs.map((j) => asRequest(j, "http")));
  });

  // ---- phase 2: headless Chromium, only for pages that need it -------------------------------
  const browserJobs = needBrowser.filter((j) => !blockedThisRun.has(j.source));
  if (browserJobs.length > 0) {
    status.pagesTotal = (status.pagesTotal ?? 0) + browserJobs.length;
    save(`Opening ${browserJobs.length} page(s) in a browser…`);
    const crawler = new PlaywrightCrawler(
      {
        maxConcurrency: 1, // polite, and keeps memory low on small hosts
        maxRequestsPerMinute: 20,
        sameDomainDelaySecs: SAME_SITE_DELAY_SECS,
        maxRequestRetries: 2,
        navigationTimeoutSecs: 45,
        requestHandlerTimeoutSecs: 300,
        launchContext: { launchOptions: LAUNCH_OPTIONS },
        preNavigationHooks: [skipHeavyContent],
        sessionPoolOptions: { blockedStatusCodes: [] },
        async requestHandler({ page, request, response, log, crawler: self }) {
          const job = jobOf(request);
          const source = sourceOf(job);
          if (blockedThisRun.has(source.id)) return finishedPage();
          startingPage(job, " in a browser");
          const reason = blockReason(response?.status() ?? 200, await page.title().catch(() => ""));
          if (reason) {
            await block(source, reason, response?.headers()["retry-after"]);
            return finishedPage();
          }
          const blocks = withoutTracking(await readCards(page, cookieLabels(source.languages), source.isListing, source.cardChars), source.stripQuery);
          await processBlocks(job, blocks, (m) => log.info(m), true);
          failed.delete(job.url); // the browser got through
          const next = await nextPage(job, blocks);
          if (next) {
            status.pagesTotal = (status.pagesTotal ?? 0) + 1;
            await self.addRequests([asRequest(next, "browser")]);
          }
          finishedPage();
        },
        async failedRequestHandler({ request }, error) {
          fail(jobOf(request), shortError(error));
          finishedPage();
          console.warn(`[crawl] browser failed ${request.url}: ${shortError(error)}`);
        },
      },
      new Configuration({ persistStorage: false }),
    );
    await crawler.run(browserJobs.map((j) => asRequest(j, "browser")));
  }

  // pages that failed in both phases count as source errors
  for (const { source, error } of failed.values()) {
    const stat = sourceStat(source);
    stat.ok = false;
    stat.error ??= error;
  }

  for (const { source, jobs } of plans) if (jobs.length > 0) await markRead(source, status.startedAt ?? new Date().toISOString());
}

/** Ads from official APIs (mobile.de), when credentials are set: they join the crawled ads before merging. */
async function readApis() {
  const source = SOURCES.find((s) => s.id === "mobile-de");
  if (!source?.enabled || !hasMobileDeAccess() || (ONLY && !ONLY.includes(source.id))) return;
  const until = notDue(source, Date.now());
  if (until) {
    sourceStat(source.id).notDueUntil = until;
    return;
  }
  save("Reading mobile.de through its API…");
  const stat = sourceStat(source.id);
  try {
    const { ads, requests } = await fetchMobileDe(settings.mobileOnly, scrapeLimits());
    stat.pages += requests;
    const limits = scrapeLimits();
    for (const { item, cardText, coords } of ads) {
      const model = matchModel(`${item.title} ${item.make ?? ""} ${item.model ?? ""}`, source.languages) ?? matchModel(cardText, source.languages);
      if (!model || !withinLimits(item, limits, model)) continue;
      if (settings.mobileOnly && !fitsMobileOnly(model, cardText, item.title)) continue;
      const id = listingId(item.url);
      if (seenThisRun.has(id)) continue;
      seenThisRun.add(id);
      stat.found++;
      collected.push({ source: source.id, sourceName: source.name, item, cardHash: cardHash(cardText), cardText, coords });
    }
    console.log(`[mobile.de] ${ads.length} ads read in ${requests} requests, ${stat.found} kept`);
    await markRead(source, status.startedAt ?? new Date().toISOString());
  } catch (e) {
    stat.ok = false;
    stat.error = shortError(e);
    console.warn(`[mobile.de] ${stat.error}`);
  }
}

async function merge() {
  save("Matching models and geocoding…");
  const now = new Date().toISOString();
  const byId = new Map(known);
  const outsideArea: string[] = [];
  const cache = readGeoCache();
  const limits = scrapeLimits();
  console.log(`[scrape] limits: max price ${limits.maxPrice ?? "none"}, max year ${limits.maxYear ?? "none"}`);

  for (const [i, { source: sourceId, sourceName, item, cardHash: hash, cardText, coords: given }] of collected.entries()) {
    if (i % 25 === 0) save(`Matching models and finding map locations: ${i + 1} of ${collected.length} ads…`);
    const source = SOURCES.find((s) => s.id === sourceId)!;
    const text = [item.title, item.make, item.model, item.description].filter(Boolean).join(" ");
    const wanted =
      matchModel(`${item.title} ${item.make ?? ""} ${item.model ?? ""}`, source.languages) ??
      matchModel(text, source.languages) ??
      // AI may summarise the word for excavator away ("Hyundai R140W"), although the card passed this same check.
      matchModel(cardText, source.languages);
    if (!wanted) continue;
    if (!withinLimits(item, limits, wanted)) continue;
    const location = source.countryCodes ? expandCountryCode(item.location) : item.location;
    const url = normalizeUrl(item.url);
    const id = listingId(url);
    // Stored before its place was known? It goes now, instead of staying in the list until it ages out.
    const drop = () => {
      if (byId.delete(id)) outsideArea.push(id);
    };
    if (isExcludedPlace(location)) {
      drop();
      continue;
    }

    const prev = byId.get(id);
    const sameLoc = prev && prev.location === location;
    const coords =
      given ?? (sameLoc && prev.lat != null ? { lat: prev.lat, lng: prev.lng! } : await geocode(location, cache, source.defaultCountry));
    if (coords && !inEurope(coords)) {
      drop();
      continue;
    }

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
      priceAmount: item.priceAmount ?? null,
      priceCurrency: item.priceCurrency ?? null,
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
  const geo = geocodeUsage();
  console.log(`[scrape] map lookups: ${geo.lookups} of ${geo.limit} allowed this run${geo.refused ? " (Nominatim refused, the rest wait for the next run)" : ""}`);
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
    await deleteListings(outsideArea);
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
    setEurRates(await loadEurRates());
    await crawl();
    await readApis();
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
