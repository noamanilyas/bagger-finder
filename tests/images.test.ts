import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { load } from "cheerio";
import type { CheerioRoot } from "crawlee";
import { collectBlocksCheerio } from "../scraper/cards";
import { isPhoto, pickPhoto } from "../scraper/images";

const PAGE = "https://example.com/search";
const GIF = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const TEXT = "Hyundai Robex 140 W-7 Mobilbagger 2006 4850h Allensbach";

/** The markup is shortened from what each site served on 2026-11-07. */
const card = (images: string) => `<div class="card"><div>${images}</div><a href="/ad/1">${TEXT}</a></div>`;
const PHOTO_IN = {
  mascus: card(
    `<img alt="Hyundai" src="${GIF}"><noscript><img alt="Hyundai" srcSet="/_next/image?url=https%3A%2F%2Fcdn.example%2Fproduct%2Fhyundai%2Cda4e6fa4.jpg&amp;w=640&amp;q=75 640w, /_next/image?url=https%3A%2F%2Fcdn.example%2Fother.jpg&amp;w=750&amp;q=75 750w"></noscript><img src="/_next/static/media/favorite_icon.svg">`,
  ),
  machineryline: card(`<img class="lazy" src="data:image/png;base64,iVBORw0KGgo" data-src="https://img.example/s/first_co"><img class="lazy" src="data:image/png;base64,iVBORw0KGgo" data-src="https://img.example/s/second_co">`),
  truck1: card(`<img class="slide-picture" data-srcset="https://www.truck1.eu/img/xxl/48572/Hyundai_1.jpg" data-first-load=""><img data-srcset="https://www.truck1.eu/img/xxl/48572/Hyundai_2.jpg">`),
  truckscout24: card(
    `<img src="https://cdn.truckscout24.com/data/customer/logo/vga/26/75188.png?v=1"><img src="https://cdn.truckscout24.com/img/frontend/main/flags/blank24.png?v=1"><img loading="lazy" src="https://cdn.truckscout24.com/data/listing/img/vga/ts/26/85/22623132-01.jpg?v=1">`,
  ),
  ece: card(`<img loading="lazy" src="https://photo.static-viamobilis.com/1/1/10999396_th.jpg"><img src="https://photo.static-viamobilis.com/vnd/133665_th.jpg">`),
};
const EXPECTED: Record<keyof typeof PHOTO_IN, string> = {
  mascus: "https://cdn.example/product/hyundai,da4e6fa4.jpg",
  machineryline: "https://img.example/s/first_co",
  truck1: "https://www.truck1.eu/img/xxl/48572/Hyundai_1.jpg",
  truckscout24: "https://cdn.truckscout24.com/data/listing/img/vga/ts/26/85/22623132-01.jpg?v=1",
  ece: "https://photo.static-viamobilis.com/1/1/10999396_th.jpg",
};

describe("card photos", () => {
  // CheerioCrawler parses with htmlparser2 (<noscript> becomes elements), plain cheerio with parse5 (it stays text).
  for (const [parser, options] of [["parse5", undefined], ["htmlparser2", { xml: { xmlMode: false } }]] as const) {
    for (const site of Object.keys(PHOTO_IN) as (keyof typeof PHOTO_IN)[]) {
      it(`${site}: finds the photo with ${parser}`, () => {
        const $ = load(PHOTO_IN[site], options) as unknown as CheerioRoot;
        const blocks = collectBlocksCheerio($, PAGE);
        assert.equal(blocks[0]?.img, EXPECTED[site]);
      });
    }
  }

  it("finds the photo when another link to the same ad has the text", () => {
    const deep = (html: string) => `<div><div><div><div><div><div>${html}</div></div></div></div></div></div>`;
    const html = `<a href="/ad/1"><img src="https://x.example/photo.jpg"></a>${deep(`<a href="/ad/1">${TEXT}</a>`)}`;
    const blocks = collectBlocksCheerio(load(html) as unknown as CheerioRoot, PAGE);
    assert.equal(blocks[0]?.text, TEXT);
    assert.equal(blocks[0]?.img, "https://x.example/photo.jpg");
  });

  it("gives nothing when a card holds only placeholders and logos", () => {
    const $ = load(card(`<img src="${GIF}"><img src="https://x.example/data/customer/logo/1.png">`)) as unknown as CheerioRoot;
    assert.equal(collectBlocksCheerio($, PAGE)[0]?.img, null);
  });

  it("resolves addresses relative to the page and keeps commas in them", () => {
    assert.equal(pickPhoto(["/p/a,b.jpg 2x"], PAGE), "https://example.com/p/a,b.jpg");
  });

  it("recognises what earlier scrapes stored", () => {
    assert.equal(isPhoto(GIF), false);
    assert.equal(isPhoto("https://cdn.truckscout24.com/img/frontend/main/flags/blank24.png?v=1"), false);
    assert.equal(isPhoto("https://img.kleinanzeigen.de/api/v1/prod-ads/images/26/261be498?rule=$_2.AUTO"), true);
  });
});
