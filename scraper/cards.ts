import type { CheerioRoot } from "crawlee";
import type { Block } from "./extract";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CheerioNode = any; // cheerio's generic node types are not worth the ceremony here

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** The same ad can be linked with a different query or hash. */
export const withoutQuery = (href: string) => href.split(/[?#]/)[0];

/**
 * Cards from server-rendered HTML: for every link, the largest small ancestor's text.
 * The climb stops before an ancestor that also links to another listing: that ancestor holds several
 * ads, and merging them gives a listing the title, price, place and photo of its neighbour.
 */
export function collectBlocksCheerio($: CheerioRoot, pageUrl: string, isListing?: (url: string) => boolean): Block[] {
  const best = new Map<string, Block>();
  const textOf = (n: CheerioNode): string => clean($(n).clone().find("script,style,noscript").remove().end().text());
  const holdsOtherListing = (n: CheerioNode, href: string): boolean => {
    if (!isListing) return false;
    return $(n)
      .find("a[href]")
      .toArray()
      .some((a: CheerioNode) => {
        try {
          const other = new URL($(a).attr("href") ?? "", pageUrl).toString();
          return isListing(other) && withoutQuery(other) !== withoutQuery(href);
        } catch {
          return false;
        }
      });
  };
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
      if (t.length > 800 || holdsOtherListing(parent, href)) break;
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
