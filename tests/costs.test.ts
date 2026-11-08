import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { withinLimits } from "../lib/config";
import { costPanel, landedAt, negotiatedRange, negotiatedText, offerRange, withinBudget, type PkrRate } from "../lib/costs";
import { parseMarketRate, parseTapTapRate } from "../lib/fx";

const RATE: PkrRate = { rate: 307, source: "Tap Tap Send", fetchedAt: "2026-11-07T10:00:00.000Z" };

describe("costPanel", () => {
  it("adds every cost to the machine price, in euros and in lakh", () => {
    const p = costPanel(25_000, RATE);
    // 25,000 + 3,200 + 1,500 to 2,000 + clearance 5,212 + transport 651
    assert.equal(p.eur, "€35.563–36.063");
    assert.equal(p.pkr, "Rs 109.2–110.7 lakh");
    assert.equal(
      p.breakdown,
      "Machine €25.000 + Rotterdam €3.200 + extra transport €1.500–2.000 + clearance €5.212 (Rs 16 lakh) + Pakistan transport €651 (Rs 2 lakh)",
    );
    assert.equal(p.rateNote, "€1 = Rs 307.00 (Tap Tap Send)");
  });

  it("shows only the costs on top when the price is on request", () => {
    const p = costPanel(null, RATE);
    assert.equal(p.eur, "Machine price + €10.563–11.063");
    assert.equal(p.pkr, "Machine price + Rs 32.4–34 lakh");
    assert.ok(!p.breakdown.includes("Machine €"));
  });

  it("keeps the rupee costs in rupees when there is no rate", () => {
    const p = costPanel(25_000, null);
    assert.equal(p.eur, "€29.700–30.200 + Rs 18 lakh");
    assert.equal(p.pkr, null);
    assert.equal(p.rateNote, "Exchange rate not available");
  });
});

describe("negotiation", () => {
  it("expects 10 to 20% off, rounded to €100", () => {
    assert.deepEqual(negotiatedRange(25_000), { low: 20_000, high: 22_500 });
    assert.deepEqual(negotiatedRange(23_450), { low: 18_800, high: 21_100 });
    assert.equal(negotiatedText(24_000), "maybe €19.200–21.600 after 10–20% off");
  });

  it("adds the costs to the discounted price", () => {
    assert.equal(costPanel(25_000, RATE).negotiated, "With 10–20% off: Rs 93.8–103 lakh · €30.563–33.563");
    assert.equal(costPanel(25_000, null).negotiated, "With 10–20% off: €24.700–27.700 + Rs 18 lakh");
  });

  it("has no discount without a price or for an ad that is not a sale", () => {
    assert.equal(costPanel(null, RATE).negotiated, null);
    assert.equal(costPanel(25_000, RATE, false).negotiated, null);
  });

  it("keeps an asking price that the biggest discount brings within budget", () => {
    assert.ok(withinBudget(45_000, 45_000));
    assert.ok(withinBudget(56_250, 45_000));
    assert.ok(!withinBudget(56_251, 45_000));
    assert.ok(withinLimits({ priceEur: 56_250, year: 2015 }, { maxPrice: 45_000, maxYear: 2015 }));
    assert.ok(!withinLimits({ priceEur: 60_000, year: 2015 }, { maxPrice: 45_000, maxYear: 2015 }));
    assert.ok(withinLimits({ priceEur: null, year: null }, { maxPrice: 45_000, maxYear: 2015 }));
  });
});

describe("exchange rate parsing", () => {
  const corridor = (fxRate: string) => ({ isoCountryCode: "PK", currency: "PKR", fxRate });

  it("reads the euro rate of the sending country", () => {
    const json = {
      availableCountries: [
        { isoCountryCode: "GB", currency: "GBP", corridors: [corridor("368.00")] },
        { isoCountryCode: "NL", currency: "EUR", corridors: [{ isoCountryCode: "IN", currency: "INR", fxRate: "100" }, corridor("307.00")] },
      ],
    };
    assert.equal(parseTapTapRate(json), 307);
  });

  it("gives no rate rather than a wrong one", () => {
    assert.equal(parseTapTapRate({}), null);
    assert.equal(parseTapTapRate({ availableCountries: [{ isoCountryCode: "NL", currency: "EUR", corridors: [corridor("abc")] }] }), null);
    assert.equal(parseMarketRate({ rates: { PKR: 0 } }), null);
    assert.equal(parseMarketRate({ rates: { PKR: 308.14 } }), 308.14);
  });
});

describe("offer slider", () => {
  it("reaches at least 30% below the asking price", () => {
    assert.deepEqual(offerRange(30_000), { min: 21_000, max: 30_000, step: 100 });
    // rounded down, so the slider never stops short of 30%
    assert.deepEqual(offerRange(23_450), { min: 16_400, max: 23_450, step: 100 });
  });
  it("lands at the same total as the cost panel for that price", () => {
    assert.deepEqual(landedAt(21_000, RATE), { pkr: costPanel(21_000, RATE).pkr, eur: costPanel(21_000, RATE).eur });
  });
});
