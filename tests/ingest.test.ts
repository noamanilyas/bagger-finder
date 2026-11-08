import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, before, describe, it } from "node:test";
import { listingId } from "../lib/listing-id";

// The store reads DATA_DIR when it loads, so the modules are imported after it is set.
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "ingest-test-"));
process.env.DATA_DIR = dataDir;
delete process.env.SUPABASE_URL;
delete process.env.SUPABASE_SECRET_KEY;

let ingest: typeof import("../lib/ingest");
let store: typeof import("../lib/store");
before(async () => {
  ingest = await import("../lib/ingest");
  store = await import("../lib/store");
});
after(() => fs.rmSync(dataDir, { recursive: true, force: true }));

const machine = {
  url: "https://dealer.example/ads/123?utm_source=feed",
  title: "Doosan DX140W Mobilbagger",
  make: "Doosan",
  model: "DX140W",
  price: 39500,
  year: 2012,
  hours: 8400,
  location: "Linz, Österreich",
  lat: 48.3,
  lng: 14.29,
  source: "Dealer feed",
};

describe("parseMachine", () => {
  it("needs a url and a title", () => {
    assert.equal(ingest.parseMachine({ title: "x" }), "url is required");
    assert.equal(ingest.parseMachine({ url: "https://a.example/1" }), "title is required");
    assert.equal(ingest.parseMachine({ url: "ftp://a.example/1", title: "x" }), "url must be http(s)");
  });

  it("fills in defaults and reads numbers given as text", () => {
    const m = ingest.parseMachine({ url: "https://a.example/1", title: "x", price: "12000", year: "2010" });
    assert.ok(typeof m === "object");
    assert.equal(m.currency, "EUR");
    assert.equal(m.adType, "sale");
    assert.equal(m.source, "External");
    assert.equal(m.price, 12000);
    assert.equal(m.year, 2010);
  });

  it("refuses unknown currencies, ad types and model keys", () => {
    assert.match(String(ingest.parseMachine({ url: "https://a.example/1", title: "x", currency: "USD" })), /currency/);
    assert.match(String(ingest.parseMachine({ url: "https://a.example/1", title: "x", adType: "wanted" })), /adType/);
    assert.match(String(ingest.parseMachine({ url: "https://a.example/1", title: "x", modelKey: "cat-320" })), /modelKey/);
  });

  it("drops an image that is not a photo", () => {
    const m = ingest.parseMachine({ url: "https://a.example/1", title: "x", imageUrl: "https://a.example/logo.svg" });
    assert.ok(typeof m === "object");
    assert.equal(m.imageUrl, null);
  });
});

describe("ingestMachines", () => {
  it("stores a wanted machine under the scraper's id and rejects the rest with a reason", async () => {
    const result = await ingest.ingestMachines([machine, { url: "https://dealer.example/ads/9", title: "Caterpillar 320" }, { title: "no url" }]);
    assert.equal(result.stored.length, 1);
    assert.equal(result.stored[0].id, listingId("https://dealer.example/ads/123"));
    assert.equal(result.stored[0].created, true);
    assert.deepEqual(
      result.rejected.map((r) => r.index),
      [1, 2],
    );
    const stored = store.readDb().listings.find((l) => l.id === result.stored[0].id);
    assert.ok(stored);
    assert.equal(stored.modelKey, "doosan-dx140");
    assert.equal(stored.source, "Dealer feed");
    assert.equal(stored.url, "https://dealer.example/ads/123");
    assert.equal(stored.wheeled, true);
    assert.equal(stored.lat, 48.3);
  });

  it("updates a machine sent again and keeps when it was first seen", async () => {
    const firstSeen = store.readDb().listings[0].firstSeen;
    const result = await ingest.ingestMachines([{ ...machine, price: 37000 }]);
    assert.equal(result.stored[0].created, false);
    const listings = store.readDb().listings;
    assert.equal(listings.length, 1);
    assert.equal(listings[0].priceEur, 37000);
    assert.equal(listings[0].firstSeen, firstSeen);
  });

  it("rejects a machine above the price limit", async () => {
    const result = await ingest.ingestMachines([{ ...machine, url: "https://dealer.example/ads/124", price: 900_000 }]);
    assert.equal(result.stored.length, 0);
    assert.match(result.rejected[0].reason, /limits/);
  });
});
