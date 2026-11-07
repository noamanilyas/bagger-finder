import type { CheerioRoot } from "crawlee";
import type { Block } from "./extract";
import { IMG_ATTRIBUTES, pickPhoto } from "./images";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CheerioNode = any; // cheerio's generic node types are not worth the ceremony here

const clean = (s: string) => s.replace(/\s+/g, " ").trim();

/** The same ad can be linked with a different query or hash. */
export const withoutQuery = (href: string) => href.split(/[?#]/)[0];

/** Text with a space between elements, so "<b>R140W</b><i>Mobilbagger</i>" does not become one word. */
function spacedTextOf(n: CheerioNode): string {
  if (n.type === "text") return n.data ?? "";
  if (n.type === "script" || n.type === "style" || n.name === "noscript") return "";
  return (n.children ?? []).map(spacedTextOf).join(" ");
}

/**
 * Cards from server-rendered HTML: for every link, the largest small ancestor's text.
 * The climb stops before an ancestor that also links to another listing: that ancestor holds several
 * ads, and merging them gives a listing the title, price, place and photo of its neighbour.
 *
 * `spaced` keeps words of different elements apart, as a browser does (Source.spacedText), and also reads cards that
 * link through data-href instead of an <a>. The older sources run without it: their parsers expect the joined text,
 * and new text would send all their stored ads back to AI.
 */
export function collectBlocksCheerio($: CheerioRoot, pageUrl: string, isListing?: (url: string) => boolean, spaced = false): Block[] {
  const best = new Map<string, Block>();
  const photos = new Map<string, string | null>();
  const links = spaced ? "a[href], [data-href]" : "a[href]";
  const linkOf = (n: CheerioNode): string | undefined => $(n).attr("href") ?? $(n).attr("data-href");
  const textOf = (n: CheerioNode): string => clean(spaced ? spacedTextOf(n) : $(n).clone().find("script,style,noscript").remove().end().text());
  const holdsOtherListing = (n: CheerioNode, href: string): boolean => {
    if (!isListing) return false;
    return $(n)
      .find(links)
      .toArray()
      .some((a: CheerioNode) => {
        try {
          const other = new URL(linkOf(a) ?? "", pageUrl).toString();
          return isListing(other) && withoutQuery(other) !== withoutQuery(href);
        } catch {
          return false;
        }
      });
  };
  $(links).each((_: number, a: CheerioNode) => {
    const raw = linkOf(a);
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
    // A card can link to its ad several times, and the link with the most text may not be the one around the photo.
    if (!photos.get(href)) {
      const imageValues = $(container)
        .find("img, noscript")
        .toArray()
        .flatMap((n: CheerioNode): string[] => (n.name === "noscript" ? [$(n).html() ?? ""] : IMG_ATTRIBUTES.map((name) => $(n).attr(name) ?? "")));
      photos.set(href, pickPhoto(imageValues, pageUrl));
    }
    if (text.length < 25) return;
    const prev = best.get(href);
    if (!prev || text.length > prev.text.length) best.set(href, { href, text: text.slice(0, 600), img: null });
  });
  return [...best.values()].map((b) => ({ ...b, img: photos.get(b.href) ?? null }));
}
