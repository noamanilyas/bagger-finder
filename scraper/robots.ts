/**
 * robots.txt for every site, read once per run: addresses it disallows are never requested, and its Crawl-delay
 * slows that site down. When the file cannot be read the site is still crawled, as robots.txt allows by default,
 * except when the answer is a refusal (401/403): then we take the site at its word and read nothing.
 */
import robotsParser from "robots-parser";

/** What we match robots.txt groups against: the generic group, like any other crawler without its own name. */
const AGENT = "*";
const TIMEOUT_MS = 15_000;

type Robots = ReturnType<typeof robotsParser>;
export type RobotsRules = { allowed: (url: string) => boolean; crawlDelaySecs: number | null; note: string | null };

const cache = new Map<string, Promise<RobotsRules>>();

/** Pure, for tests: rules from a robots.txt body. */
export function rulesFrom(robotsUrl: string, body: string): RobotsRules {
  const robots: Robots = robotsParser(robotsUrl, body);
  const delay = robots.getCrawlDelay(AGENT);
  return { allowed: (url) => robots.isAllowed(url, AGENT) !== false, crawlDelaySecs: delay ?? null, note: null };
}

async function fetchRules(origin: string): Promise<RobotsRules> {
  const url = `${origin}/robots.txt`;
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bagger-finder)", Accept: "text/plain,*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status === 401 || res.status === 403) {
      return { allowed: () => false, crawlDelaySecs: null, note: `robots.txt answered ${res.status}` };
    }
    if (!res.ok) return { allowed: () => true, crawlDelaySecs: null, note: `no robots.txt (${res.status})` };
    const body = await res.text();
    // Some sites answer with a bot check page instead of the file: that is a refusal too.
    if (/<html/i.test(body.slice(0, 500))) return { allowed: () => false, crawlDelaySecs: null, note: "robots.txt answered with a web page" };
    return rulesFrom(url, body);
  } catch (e) {
    return { allowed: () => true, crawlDelaySecs: null, note: `robots.txt not read (${(e as Error).message})` };
  }
}

export function robotsFor(pageUrl: string): Promise<RobotsRules> {
  const origin = new URL(pageUrl).origin;
  let found = cache.get(origin);
  if (!found) {
    found = fetchRules(origin);
    cache.set(origin, found);
  }
  return found;
}
