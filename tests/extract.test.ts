import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

// Only the OpenRouter route, so the fake below answers every model.
delete process.env.GEMINI_API_KEY;
delete process.env.GROQ_API_KEY;
process.env.OPENROUTER_API_KEY = "test";

const realFetch = globalThis.fetch;

/** Answers model discovery with no models and every chat with this reply. */
function fakeModel(location: string | null, url: string) {
  globalThis.fetch = (async (address: string) => {
    if (String(address).endsWith("/models")) return Response.json({ data: [] });
    const content = JSON.stringify({ listings: [{ url, title: "Hyundai Robex 140 W", location, adType: "sale" }] });
    return Response.json({ choices: [{ message: { content } }] });
  }) as typeof fetch;
}

describe("AI extraction of the place", () => {
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  const href = "https://www.mascus.de/baumaschinen/mobilbagger/hyundai-robex-140-w/efibgdde.html";
  const block = {
    href,
    img: null,
    text: "15 Hyundai Robex 140 W Faiz Brothers Co. LTD Mobilbagger • 2013 • -, KR • Faiz Brothers Co. LTD Preis auf Anfrage Favoriten Faiz Brothers Co. LTD",
  };
  const mascus = { id: "mascus", name: "Mascus", languages: ["de", "en"] } as Parameters<typeof import("../scraper/extract").extract>[1];

  it("takes the place from the card when the model leaves it out", async () => {
    const { extract } = await import("../scraper/extract");
    fakeModel(null, href);
    const { items, via } = await extract([block], mascus);
    assert.equal(via, "ai");
    assert.equal(items[0].location, "South Korea");
  });

  it("keeps the place the model gives", async () => {
    const { extract } = await import("../scraper/extract");
    fakeModel("Seoul, South Korea", href);
    const { items } = await extract([block], mascus);
    assert.equal(items[0].location, "Seoul, South Korea");
  });
});
