import type { Page } from "playwright";
import { withoutQuery } from "./cards";
import type { Block } from "./extract";
import { IMG_ATTRIBUTES, pickPhoto } from "./images";

export const LAUNCH_OPTIONS = { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"] };

/** We only need text and links: skip images, fonts and media to save memory and bandwidth. */
export async function skipHeavyContent({ page }: { page: Page }) {
  await page.route("**/*", (route) =>
    ["image", "font", "media"].includes(route.request().resourceType()) ? route.abort() : route.continue(),
  );
}

/** Reads the cards of a page opened in the browser. Same rules as collectBlocksCheerio. */
export async function readCards(page: Page, cookieButtons: string[], isListing?: (url: string) => boolean, maxChars = 600): Promise<Block[]> {
  await page.waitForLoadState("domcontentloaded");
  // Dismiss cookie banners if there is one.
  for (const label of cookieButtons) {
    await page.getByRole("button", { name: label }).first().click({ timeout: 1200 }).catch(() => undefined);
  }
  await page.waitForTimeout(2000);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(1000);

  // A card must not grow into an ancestor holding another listing.
  const allLinks = await page.$$eval("a[href]", (as) => as.map((a) => (a as HTMLAnchorElement).href));
  const listingLinks = isListing ? allLinks.filter(isListing).map(withoutQuery) : [];

  const cards = await page.evaluate(({ listings, imgAttributes, cut }) => {
    const listingSet = new Set(listings);
    const best = new Map<string, string>();
    const images = new Map<string, string[]>();
    document.querySelectorAll("a[href]").forEach((a) => {
      const href = (a as HTMLAnchorElement).href;
      if (!/^https?:/.test(href) || href.split("#")[0] === location.href.split("#")[0]) return;
      const own = href.split(/[?#]/)[0];
      let el: HTMLElement = a as HTMLElement;
      let text = el.innerText || "";
      let container: HTMLElement = el;
      for (let i = 0; i < 5 && el.parentElement; i++) {
        el = el.parentElement;
        const t = el.innerText || "";
        if (t.length > Math.max(800, cut)) break;
        const holdsOther = Array.from(el.querySelectorAll("a[href]")).some((x) => {
          const other = (x as HTMLAnchorElement).href.split(/[?#]/)[0];
          return other !== own && listingSet.has(other);
        });
        if (holdsOther) break;
        text = t;
        container = el;
      }
      text = text.replace(/\s+/g, " ").trim();
      // A card can link to its ad several times, and the link with the most text may not be the one around the photo.
      images.set(href, [
        ...(images.get(href) ?? []),
        ...Array.from(container.querySelectorAll("img, noscript")).flatMap((n) =>
          n.tagName === "NOSCRIPT" ? [n.textContent ?? ""] : imgAttributes.map((name) => n.getAttribute(name) ?? ""),
        ),
      ]);
      if (text.length < 25) return;
      const prev = best.get(href);
      if (!prev || text.length > prev.length) best.set(href, text.slice(0, cut));
    });
    return [...best].map(([href, text]) => ({ href, text, imageValues: images.get(href) ?? [] }));
  }, { listings: listingLinks, imgAttributes: IMG_ATTRIBUTES, cut: maxChars });

  return cards.map(({ href, text, imageValues }) => ({ href, text, img: pickPhoto(imageValues, page.url()) }));
}
