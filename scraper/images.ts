/**
 * Finds a card's photo. Sites load photos lazily, so an <img> often holds a placeholder in `src` and the real address
 * elsewhere: in a data-* attribute (Machineryline, Truck1) or in a <noscript> copy (Mascus). Cards also hold images that
 * are not the machine: seller logos and flags (TruckScout24, Europe-Construction-Equipment), and icons.
 */

/** Where an <img> keeps its address, most reliable first: `src` may be a placeholder until the image is scrolled to. */
export const IMG_ATTRIBUTES = ["data-src", "data-lazy-src", "data-original", "data-srcset", "src", "srcset"];

const NOT_A_PHOTO =
  /^(?:data|blob):|\.(?:svg|gif)(?:[?#]|$)|\/(?:flags?|logos?|icons?|vnd|static\/media)\/|\/blank[^/]*$|\/no_pic|placeholder/i;

export const isPhoto = (url: string) => !NOT_A_PHOTO.test(url);

/** "a.jpg 640w, b.jpg 750w" gives "a.jpg". Addresses can hold commas (Mascus), so only whitespace ends the first one. */
const firstAddress = (value: string) => value.trim().split(/\s+/)[0].replace(/,$/, "");

/** <noscript> holds markup, as text or as parsed elements depending on the parser. */
const addressesInMarkup = (html: string) =>
  [...html.matchAll(/\b(?:src|srcset)\s*=\s*"([^"]+)"/gi)].map((m) => m[1].replace(/&amp;/g, "&"));

/** Next.js serves images through /_next/image?url=<the real address>&w=640. */
function resolve(address: string, pageUrl: string): string | null {
  try {
    const url = new URL(address, pageUrl);
    if (url.pathname.endsWith("/_next/image") && url.searchParams.get("url")) {
      return new URL(url.searchParams.get("url")!, pageUrl).toString();
    }
    return url.toString();
  } catch {
    return null;
  }
}

/**
 * The first real photo among a card's images, or null.
 * `values` are the card's IMG_ATTRIBUTES values and <noscript> contents, in page order.
 */
export function pickPhoto(values: string[], pageUrl: string): string | null {
  for (const value of values) {
    if (!value) continue;
    for (const address of value.includes("<") ? addressesInMarkup(value) : [value]) {
      const url = resolve(firstAddress(address), pageUrl);
      if (url && /^https?:/.test(url) && isPhoto(url)) return url;
    }
  }
  return null;
}
