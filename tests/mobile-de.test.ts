/** mobile.de's Search-API client, on responses shaped as its documentation describes (no credentials exist yet). */
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { classify, fitsMobileOnly, matchModel } from "../lib/config";
import { categoriesFor, fetchMobileDe, mapMobileDeAd, searchUrl } from "../scraper/mobile-de-api";

const AD = {
  detailPageUrl: "https://suchen.mobile.de/fahrzeuge/details.html?id=123456789",
  make: "Doosan",
  model: "DX140W-5",
  price: { consumerPriceGross: "44625.00", consumerPriceNet: "37500.00", currency: "EUR" },
  constructionYear: 2014,
  operatingHours: 8200,
  seller: { address: { zipcode: "12681", city: "Berlin", "country-code": "DE" }, geoData: { lat: 52.53, lon: 13.53 } },
  images: [{ m: "https://img.classistatic.de/api/v1/mo-prod/images/ab/abc?rule=mo-640.jpg" }],
};

describe("mobile.de ads", () => {
  it("map to a listing that the model filters keep as a Mobilbagger", () => {
    const ad = mapMobileDeAd(AD, "MobileDigger")!;
    assert.equal(ad.item.title, "Doosan DX140W-5");
    assert.deepEqual([ad.item.priceEur, ad.item.year, ad.item.hours, ad.item.location], [44625, 2014, 8200, "12681 Berlin"]);
    assert.equal(ad.item.priceNote, "net €37.500 (excl. VAT)");
    assert.deepEqual(ad.coords, { lat: 52.53, lng: 13.53 });
    const model = matchModel(ad.cardText, ["de"]);
    assert.equal(model?.key, "doosan-dx140");
    assert.ok(fitsMobileOnly(model!, ad.cardText, ad.item.title));
  });

  it("an ad without a price, or with a net price only, stays", () => {
    const noPrice = mapMobileDeAd({ ...AD, price: { type: "ON_REQUEST" } }, "MobileDigger")!;
    assert.equal(noPrice.item.priceEur, null);
    const netOnly = mapMobileDeAd({ ...AD, price: { consumerPriceNet: { amount: 30000 }, currency: "EUR" } }, "MobileDigger")!;
    assert.deepEqual([netOnly.item.priceEur, netOnly.item.priceNote], [30000, "excl. VAT"]);
  });

  it("a foreign seller keeps the country, and an ad without an address is dropped", () => {
    const at = mapMobileDeAd({ ...AD, seller: { address: { zipcode: "2325", city: "Himberg", "country-code": "AT" } } }, "MobileDigger")!;
    assert.equal(at.item.location, "2325 Himberg, AT");
    assert.equal(at.coords, undefined);
    assert.equal(mapMobileDeAd({ make: "Doosan" }, "MobileDigger"), null);
  });

  it("a crawler category says so, so the wheeled filter turns it down", () => {
    const ad = mapMobileDeAd({ ...AD, model: "DX140LC-5" }, "CaterpillarDigger")!;
    const model = classify(ad.cardText, ["de"]).model!;
    assert.equal(fitsMobileOnly(model, ad.cardText, ad.item.title), false);
  });

  it("searches used construction machines by category, newest first, with the year limit", () => {
    const url = new URL(searchUrl("MobileDigger", 2, { maxYear: 2015 }));
    assert.equal(url.origin + url.pathname, "https://services.mobile.de/search-api/search");
    assert.equal(url.searchParams.get("classification"), "refdata/classes/ConstructionMachine");
    assert.equal(url.searchParams.get("category"), "MobileDigger");
    assert.equal(url.searchParams.get("condition"), "USED");
    assert.equal(url.searchParams.get("page.number"), "2");
    assert.equal(url.searchParams.get("constructionYear.max"), "2015");
    assert.equal(url.searchParams.get("price.max"), null, "no price filter: it would drop ads without a price");
    assert.deepEqual(categoriesFor(true), ["MobileDigger", "WheeledLoader", "Grader", "Roller"]);
  });
});

describe("reading the API", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });
  const respond = (status: number, body: unknown, headers: Record<string, string> = {}) =>
    new Response(typeof body === "string" ? body : JSON.stringify(body), { status, headers });

  it("pages through a category and stops at a short page", { timeout: 30_000 }, async () => {
    process.env.MOBILE_DE_API_USER = "u";
    process.env.MOBILE_DE_API_PASSWORD = "p";
    const seen: string[] = [];
    globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
      seen.push(String(input));
      assert.equal((init?.headers as Record<string, string>).Authorization, `Basic ${Buffer.from("u:p").toString("base64")}`);
      return respond(200, { total: 1, maxPages: 1, ads: [AD] });
    }) as typeof fetch;
    const { ads, requests } = await fetchMobileDe(true, { maxPrice: 45000, maxYear: 2015 });
    assert.equal(requests, 4, "one page per category");
    assert.equal(ads.length, 4);
    assert.ok(seen.every((u) => u.startsWith("https://services.mobile.de/search-api/search?")));
  });

  it("a rate limit ends the run quietly with what was read; refused credentials are an error", { timeout: 30_000 }, async () => {
    process.env.MOBILE_DE_API_USER = "u";
    process.env.MOBILE_DE_API_PASSWORD = "p";
    globalThis.fetch = (async () => respond(429, "slow down", { "retry-after": "60" })) as typeof fetch;
    assert.deepEqual(await fetchMobileDe(true, { maxPrice: null, maxYear: null }), { ads: [], requests: 1 });
    globalThis.fetch = (async () => respond(401, "no")) as typeof fetch;
    await assert.rejects(fetchMobileDe(true, { maxPrice: null, maxYear: null }), /refused the credentials \(HTTP 401\)/);
    delete process.env.MOBILE_DE_API_USER;
    delete process.env.MOBILE_DE_API_PASSWORD;
  });
});
