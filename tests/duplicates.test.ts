import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { duplicateCount, machineGroups, oneCardPerMachine } from "../lib/duplicates";
import { applyMarket } from "../lib/market";
import type { Listing } from "../lib/types";

let n = 0;
const ad = (over: Partial<Listing>) =>
  ({
    id: `ad${++n}`,
    url: `https://example.com/${n}`,
    source: "Mascus",
    title: "Doosan DX140W-3",
    make: "Doosan",
    model: "DX140W-3",
    modelKey: "doosan-dx140",
    wheeled: true,
    priceEur: 49800,
    year: 2014,
    hours: 6532,
    location: "Germany",
    imageUrl: null,
    lat: null,
    lastSeen: "2026-11-08T12:00:00Z",
    adType: "sale",
    ...over,
  }) as Listing;

const sizes = (ls: Listing[]) => machineGroups(ls).map((g) => g.length).sort((a, b) => b - a);

describe("machineGroups", () => {
  it("joins the Doosan DX140W-3 from one dealer on four sites, twice on Mascus", () => {
    const ls = [
      ad({ source: "Europe-Construction-Equipment", title: "Doosan wheel excavator DX140 W 3", make: null, model: null, location: "Hessen, Germany" }),
      ad({ source: "Machineryline", location: "Fürth ( Hessen ), Deutschland" }),
      ad({ source: "Mascus" }),
      ad({ source: "Mascus" }),
      // no year or hours on this site: joins through the town
      ad({ source: "TruckScout24", year: null, hours: null, location: "Fürth, Deutschland" }),
    ];
    assert.deepEqual(sizes(ls), [5]);
  });

  it("joins the Hyundai Robex 140W-7A without hours through the year", () => {
    const ls = [
      ad({ modelKey: "hyundai-140", priceEur: 27000, year: 2008, hours: null, location: "Poland" }),
      ad({ modelKey: "hyundai-140", priceEur: 27000, year: 2008, hours: null, location: "Lubartów, Polen", source: "Machineryline" }),
    ];
    assert.deepEqual(sizes(ls), [2]);
  });

  it("keeps machines apart when year, hours, country, model, type or price differ", () => {
    const base = ad({});
    for (const other of [
      { year: 2015 },
      { hours: 7000 },
      { location: "Lyon, France" },
      { modelKey: "doosan-dx160" },
      { wheeled: false },
      { priceEur: 49500 },
    ]) {
      assert.deepEqual(sizes([base, ad(other)]), [1, 1], JSON.stringify(other));
    }
  });

  it("needs something to agree beyond model and price", () => {
    // 1:50 toy models of a CAT 966F, all at 70 euros, in different towns and mostly without a year
    const toy = { modelKey: "cat-966f2", wheeled: false, priceEur: 70, hours: null };
    const ls = [ad({ ...toy, year: 1992, location: "Hamm" }), ad({ ...toy, year: null, location: "Pfedelbach" }), ad({ ...toy, year: null, location: "Unterliederbach" })];
    assert.deepEqual(sizes(ls), [1, 1, 1]);
  });

  it("never groups ads without a price", () => {
    assert.deepEqual(sizes([ad({ priceEur: null }), ad({ priceEur: null })]), [1, 1]);
  });

  it("does not chain two different machines through an ad that lacks the facts", () => {
    const ls = [ad({ hours: 6532, location: "Fürth" }), ad({ hours: 7000, location: "Fürth" }), ad({ year: null, hours: null, location: "Fürth" })];
    assert.deepEqual(sizes(ls), [2, 1]);
  });
});

describe("oneCardPerMachine", () => {
  it("shows the fullest ad and links the others, keeping comments from all of them", () => {
    const full = ad({ source: "Machineryline", location: "Fürth ( Hessen ), Deutschland", imageUrl: "x.jpg" });
    const thin = ad({ source: "TruckScout24", year: null, hours: null, location: "Fürth, Deutschland", knowledge: [{ id: 7, note: "call", interesting: true, thisAdOnly: true }] });
    const [card, ...rest] = oneCardPerMachine([thin, full]);
    assert.equal(rest.length, 0);
    assert.equal(card.id, full.id);
    assert.deepEqual(card.alsoOn, [{ id: thin.id, source: "TruckScout24", url: thin.url }]);
    assert.equal(card.knowledge?.[0].id, 7);
  });

  it("leaves a machine advertised once as it is", () => {
    const one = ad({});
    assert.equal(oneCardPerMachine([one])[0], one);
  });
});

describe("market comparison", () => {
  it("counts a machine on several sites once", () => {
    const peers = [30000, 31000, 32000, 33000, 34000].map((p, i) => ad({ priceEur: p, hours: 1000 + i }));
    const copies = [1, 2, 3].map(() => ad({ priceEur: 30000, hours: 1000, source: "Truck1" }));
    const target = ad({ priceEur: 20000, hours: 5000 });
    const out = applyMarket([...peers, ...copies, target]).find((l) => l.id === target.id)!;
    assert.equal(out.marketCount, 5);
    assert.equal(out.marketMedian, 32000);
  });

  it("reports how many ads are repeats", () => {
    assert.deepEqual(duplicateCount([ad({}), ad({ source: "Truck1" }), ad({ year: 2010 })]), { machines: 1, extraAds: 1 });
  });
});
