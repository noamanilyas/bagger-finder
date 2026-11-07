/**
 * Shows what the scraper would do with a site, without saving anything and without AI. Use it before enabling a source.
 *   npm run try-source -- mascus                   the source's first page
 *   npm run try-source -- mascus --pages 3         its first three pages
 *   npm run try-source -- mascus --url <address>   any other page, read the way this source is read
 *   npm run try-source -- truck1 --browser         force the browser (sources can also ask for it in lib/config.ts)
 *   npm run try-source -- mascus --all             also list each rejected card
 *   npm run try-source -- mascus --raw 5           also print the address and full text of five cards, to write a parser
 *   npm run try-source -- otomoto --all-types      first pages of every search, as with "all excavator types"
 */
import { CheerioCrawler, Configuration, PlaywrightCrawler } from "crawlee";
import { SOURCES, classify, isWheeled, looksRelevant, scrapeLimits, seedUrls, withinLimits } from "../lib/config";
import { formatAmount, setEurRates } from "../lib/currency";
import { loadEurRates } from "../lib/fx";
import { countryOf, expandCountryCode, isExcludedPlace } from "../lib/countries";
import { cookieLabels } from "../lib/languages";
import { blockReason } from "./blocks";
import { LAUNCH_OPTIONS, readCards, skipHeavyContent } from "./browser";
import { collectBlocksCheerio, withoutTracking } from "./cards";
import { heuristicItem, type Block } from "./extract";
import { fetchMobileDe, hasMobileDeAccess } from "./mobile-de-api";
import { robotsFor } from "./robots";

const args = process.argv.slice(2);
const flag = (name: string) => args.includes(`--${name}`);
const option = (name: string) => {
  const at = args.indexOf(`--${name}`);
  return at >= 0 ? args[at + 1] : undefined;
};

const source = SOURCES.find((s) => s.id === args[0]);
if (!source) {
  console.error(`Which source? One of: ${SOURCES.map((s) => s.id).join(", ")}`);
  process.exit(1);
}

const pages = Number(option("pages") ?? 1);
const custom = option("url");
const urls = custom ? [custom] : seedUrls(source, flag("all-types") ? false : true).slice(0, pages);
const useBrowser = flag("browser") || source.browser === true;
const showAll = flag("all");
// In memory only: leave no request queue behind.
const config = new Configuration({ persistStorage: false });

type PageResult = { url: string; blocks: Block[] };
const results: PageResult[] = [];

async function read() {
  const failures: string[] = [];
  for (const url of urls) {
    const rules = await robotsFor(url);
    if (rules.note) console.log(`robots: ${rules.note}`);
    if (rules.crawlDelaySecs) console.log(`robots: Crawl-delay ${rules.crawlDelaySecs} s`);
    if (!rules.allowed(url)) failures.push(`${url}: disallowed by robots.txt, not read`);
  }
  const allowed = new Set(urls.filter((u) => !failures.some((f) => f.startsWith(`${u}:`))));
  if (useBrowser) {
    const crawler = new PlaywrightCrawler(
      {
        maxConcurrency: 1,
        maxRequestRetries: 0,
        navigationTimeoutSecs: 45,
        launchContext: { launchOptions: LAUNCH_OPTIONS },
        preNavigationHooks: [skipHeavyContent],
        sessionPoolOptions: { blockedStatusCodes: [] },
        async requestHandler({ page, request, response }) {
          const reason = blockReason(response?.status() ?? 200, await page.title().catch(() => ""));
          if (reason) return void failures.push(`${request.url}: ${reason}`);
          results.push({ url: request.url, blocks: withoutTracking(await readCards(page, cookieLabels(source!.languages), source!.isListing, source!.cardChars), source!.stripQuery) });
        },
        failedRequestHandler({ request }, error) {
          failures.push(`${request.url}: ${error.message.split("\n")[0]}`);
        },
      },
      config,
    );
    await crawler.run([...allowed]);
  } else {
    const crawler = new CheerioCrawler(
      {
        maxConcurrency: 1,
        maxRequestRetries: 0,
        sameDomainDelaySecs: source!.delaySecs ?? 3,
        ignoreHttpErrorStatusCodes: [401, 403, 429, 503],
        sessionPoolOptions: { blockedStatusCodes: [] },
        async requestHandler({ $, request, response }) {
          const reason = blockReason(response.statusCode ?? 0, $("title").first().text());
          if (reason) return void failures.push(`${request.url}: ${reason}`);
          results.push({ url: request.url, blocks: withoutTracking(collectBlocksCheerio($, request.loadedUrl ?? request.url, source!.isListing, source!.spacedText, source!.cardChars), source!.stripQuery) });
        },
        failedRequestHandler({ request }, error) {
          failures.push(`${request.url}: ${error.message.split("\n")[0]}`);
        },
      },
      config,
    );
    await crawler.run([...allowed]);
  }
  return failures;
}

const number = (n: number | null) => (n == null ? "-" : n.toLocaleString("de-DE"));

/** mobile.de is read through its API: show what it returns, without saving anything. */
async function tryApi() {
  if (!hasMobileDeAccess()) {
    console.log("mobile.de: no API credentials (MOBILE_DE_API_USER, MOBILE_DE_API_PASSWORD), nothing to try.");
    return;
  }
  const { ads, requests } = await fetchMobileDe(!flag("all-types"), scrapeLimits());
  console.log(`mobile.de: ${ads.length} ads in ${requests} requests`);
  for (const { item, cardText } of ads.slice(0, Number(option("raw") ?? 20))) {
    const decision = classify(cardText, source!.languages);
    console.log(`  ${decision.model ? "KEEP" : "no  "} ${decision.model?.label ?? decision.reason} | ${item.title} | € ${item.priceEur ?? "-"} | ${item.year ?? "-"} | ${item.hours ?? "-"} h | ${item.location ?? "no place"}`);
  }
}

async function main() {
  setEurRates(await loadEurRates());
  if (source!.api) return tryApi();
  console.log(`\n${source!.name} (${source!.enabled ? "enabled" : "not enabled"}), languages: ${source!.languages.join(", ")}, AI: ${source!.ai === false ? "never" : "allowed"}, ${useBrowser ? "browser" : "plain HTTP"}`);
  const failures = await read();
  for (const f of failures) console.log(`FAILED ${f}`);

  const limits = scrapeLimits();
  const totals = { links: 0, listingLinks: 0, kept: 0, wheeled: 0, overLimit: 0, excludedPlace: 0, noPlace: 0, noPrice: 0 };
  const seen = new Set<string>();
  const reasons = new Map<string, number>();

  for (const { url, blocks } of results) {
    const ads = blocks.filter((b) => !source!.isListing || source!.isListing(b.href));
    console.log(`\n=== ${url}\n    ${blocks.length} links, ${ads.length} ads`);
    totals.links += blocks.length;
    totals.listingLinks += ads.length;
    for (const b of ads.slice(0, Number(option("raw") ?? 0))) console.log(`  RAW ${b.href}\n      ${b.text}`);

    for (const b of ads) {
      if (seen.has(b.href)) continue;
      seen.add(b.href);
      if (!source!.isListing && !looksRelevant(b.text)) continue;
      const item = heuristicItem(b, source!);
      const decision = classify(item.title, source!.languages).model ? classify(item.title, source!.languages) : classify(b.text, source!.languages);
      if (!decision.model) {
        const reason = decision.reason.replace(/".*"/, "").trim();
        reasons.set(reason, (reasons.get(reason) ?? 0) + 1);
        if (showAll) console.log(`  no   ${decision.reason} | ${b.text.slice(0, 110)}`);
        continue;
      }
      const inLimits = withinLimits(item, limits, decision.model);
      const wheeled = isWheeled(`${item.title} ${b.text}`, item.title);
      const place = source!.countryCodes ? expandCountryCode(item.location) : item.location;
      const excluded = isExcludedPlace(place);
      totals.kept++;
      if (wheeled) totals.wheeled++;
      if (!inLimits) totals.overLimit++;
      if (excluded) totals.excludedPlace++;
      if (!place) totals.noPlace++;
      if (item.priceEur == null) totals.noPrice++;
      console.log(
        `  ${excluded ? "away" : inLimits ? "KEEP" : "over"} ${decision.model.label} | ${wheeled ? "wheeled" : "not wheeled"} | ${item.title.slice(0, 50)} | € ${number(item.priceEur)}${item.priceCurrency && item.priceAmount != null ? ` (${formatAmount(item.priceAmount, item.priceCurrency)})` : ""} | ${item.year ?? "-"} | ${number(item.hours)} h | ${place ?? "no place"}${place && countryOf(place) ? ` [${countryOf(place)!.code}]` : ""}`,
      );
    }
  }

  console.log(`\nSummary: ${results.length} of ${urls.length} pages read, ${totals.links} links, ${totals.listingLinks} ads.`);
  console.log(`  ${totals.kept} match a wanted model: ${totals.wheeled} wheeled, ${totals.overLimit} over your price/year limits, ${totals.excludedPlace} in excluded countries, ${totals.noPrice} without a price, ${totals.noPlace} without a place.`);
  if (reasons.size > 0) {
    console.log("  Turned down:");
    for (const [reason, n] of [...reasons].sort((a, b) => b[1] - a[1])) console.log(`    ${n} × ${reason}`);
  }
  if (totals.listingLinks === 0) console.log("  No ads found: check the URL and isListing, or try --browser.");
}

void main();
