import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SOURCES, WANTED, classify, fitsMobileOnly, isWheeled, matchModel, withinLimits } from "../lib/config";
import { LANGUAGES, type Language } from "../lib/languages";
import type { Db } from "../lib/types";
import { legacyIsWheeled, legacyMatchModel } from "./legacy-filters";

const ALL = Object.values(LANGUAGES) as Language[];

describe("every language proves itself with its own examples", () => {
  for (const lang of ALL) {
    it(lang.code, () => {
      for (const ad of lang.examples.wheeled) {
        assert.ok(matchModel(ad, [lang.code]), `should be kept: ${ad} (${classify(ad, [lang.code]).reason})`);
        assert.ok(isWheeled(ad), `should be wheeled: ${ad}`);
      }
      for (const ad of lang.examples.keep ?? []) {
        assert.ok(matchModel(ad, [lang.code]), `should be kept: ${ad} (${classify(ad, [lang.code]).reason})`);
      }
      for (const ad of lang.examples.drop) {
        assert.equal(matchModel(ad, [lang.code]), null, `should be dropped: ${ad}`);
      }
    });
  }
});

describe("languages do not clash", () => {
  // A source may declare any mix of languages, so one language's exclusions must not delete another's real machines.
  it("no language's exclusions reject another language's wheeled excavator", () => {
    const clashes: string[] = [];
    for (const excluding of ALL) {
      for (const other of ALL) {
        for (const ad of other.examples.wheeled) {
          const decision = classify(ad, [excluding.code]);
          if (!decision.model) clashes.push(`${excluding.code} rejects "${ad}" (${other.code}): ${decision.reason}`);
        }
      }
    }
    assert.deepEqual(clashes, []);
  });

  it("positive words work on every source, whatever it declares", () => {
    assert.ok(matchModel("Koparka kołowa Hyundai R140W", ["de"]));
    assert.ok(matchModel("Bandenkraan Hyundai R140W", ["de"]));
  });

  it("exclusions stay with their language", () => {
    const englishCard = "Hyundai R140W excavator Location: Germany";
    assert.ok(matchModel(englishCard, ["en"]));
    assert.ok(matchModel(englishCard, ["fr"]), "French 'location' only counts at the start of an ad");
    const frenchRental = "Location pelle sur pneus Hyundai R140W";
    assert.equal(matchModel(frenchRental, ["fr"]), null);
    assert.ok(matchModel(frenchRental, ["en"]), "not a French source, so the French exclusion stays off");
  });

  it("weak words only count on their own language's sources", () => {
    assert.equal(matchModel("Hyundai R55 sedili in pelle", ["de"]), null);
    assert.ok(matchModel("Pelle Hyundai R55", ["fr"]));
  });

  it("missing accents are forgiven, except in German", () => {
    assert.ok(isWheeled("koparka kolowa"));
    assert.ok(isWheeled("KOPARKA KOŁOWA"));
    assert.ok(matchModel("Hyundai R140 Bagger von ACME Trader", ["de"]), "'räder' must not become 'rader'");
  });

  it("words only match whole words", () => {
    assert.equal(isWheeled("kopernik kołowy"), false);
    assert.ok(matchModel("Koparka Hyundai R140 kolor żółty", ["pl"]), "'koło' is not in 'kolor'");
  });
});

describe("nothing that used to work is lost", () => {
  const CARDS = [
    "Hyundai R140W-7 Mobilbagger 2012 8.500 h 45.000 €",
    "Doosan DX 140 W Radbagger",
    "Yanmar B55W-2 Mobilbagger",
    "Yanmar ViO55 Minibagger",
    "Hyundai HW140 wheel excavator",
    "Hyundai Robex 140W-7A wheeled excavator",
    "Develon DX55W Mobile excavator",
    "Daewoo DX210W Bagger",
    "Dosan DX60 Bagger",
    "Doosan DX140 zu mieten",
    "Doosan DX140 Bagger / Tag 200 €",
    "Hyundai R140 Reifen",
    "Hyundai 225/55 R18",
    "Fahrantrieb Hyundai R140 Bagger",
    "Hydraulischer Schnellwechsler Doosan DX55 Bagger",
    "Motor Hyundai R140",
    "Motor für Hyundai R140 Bagger",
    "Kabine Doosan DX140",
    "Hyundai R170W-9 Mobilbagger",
    "Hyundai R150 Bagger",
    "Suche Hyundai R140 Bagger",
    "Radlader Hyundai HL730 R140",
    "Hyundai R55",
    "Yanmar 55",
    "Yanmar 1.755 Bagger",
    "Lanturi Doosan DX140 Bagger",
    "Generator Doosan DX55 Bagger",
    "Trader Grader Hyundai R140 Bagger",
  ];

  it("matches the frozen filters on German-style cards", () => {
    for (const card of CARDS) {
      assert.equal(matchModel(card)?.key ?? null, legacyMatchModel(card)?.key ?? null, card);
    }
  });

  it("every old wheeled verdict still holds", () => {
    for (const card of CARDS) {
      if (legacyIsWheeled(card)) assert.ok(isWheeled(card), card);
    }
  });

  const db = "data/listings.json";
  it("keeps every stored listing the frozen filters keep", { skip: !existsSync(db) && "no local data" }, () => {
    const { listings } = JSON.parse(readFileSync(db, "utf8")) as Db;
    for (const l of listings) {
      const text = [l.title, l.make, l.model, l.description, l.cardText].filter(Boolean).join(" ");
      for (const candidate of [l.title, text]) {
        const before = legacyMatchModel(candidate);
        if (before) assert.equal(matchModel(candidate)?.key, before.key, candidate.slice(0, 120));
      }
      if (legacyIsWheeled(text)) assert.ok(isWheeled(text), text.slice(0, 120));
    }
  });
});

describe("what is new compared with the frozen filters", () => {
  it("Hyundai's HW range now counts as wheeled", () => {
    assert.ok(isWheeled("Hyundai HW 140 Bagger"));
    assert.equal(legacyIsWheeled("Hyundai HW 140 Bagger"), false);
  });

  it("a title naming a crawler beats a wheeled category label on the card", () => {
    const seen = "Doosan Kettenbagger DX 140 LCR-5 Mobilbagger • 2020 • 2900h";
    assert.equal(legacyIsWheeled(seen), true, "this is the mistake being fixed");
    assert.equal(isWheeled(seen, "Doosan Kettenbagger DX 140 LCR-5"), false);
    assert.equal(isWheeled("Hyundai R140LC-9 Mobilbagger", "Hyundai R140LC-9"), false);
    assert.equal(isWheeled("Koparka gąsienicowa Hyundai R140 koparka kołowa", "Koparka gąsienicowa Hyundai R140"), false);
  });

  it("a title that also says wheeled, or says nothing, leaves the card to decide", () => {
    assert.ok(isWheeled("Doosan DX140W-3 Mobilbagger", "Doosan DX140W-3"));
    assert.ok(isWheeled("Volvo EW 140 Mobilbagger", "Volvo EW 140"));
    assert.ok(isWheeled("Mobilbagger und Kettenbagger Hyundai R140", "Hyundai R140"), "dealer text elsewhere on the card is not the title");
  });
});

describe("wanted Doosan sizes", () => {
  it("DX160 and DX190 count, however they are written", () => {
    for (const card of ["Doosan DX160W-5 Mobilbagger", "Doosan DX 160 WR Mobilbagger", "Develon DX 160 W"]) {
      assert.equal(matchModel(card)?.key, "doosan-dx160", card);
    }
    for (const card of ["Doosan DX190W-5 Mobilbagger", "Doosan DX 190 W-7 Mobilbagger"]) {
      assert.equal(matchModel(card)?.key, "doosan-dx190", card);
    }
  });

  it("neighbouring sizes stay out", () => {
    for (const card of ["Doosan DX165W-5 Mobilbagger", "Doosan DX 150 W Mobilbagger", "Doosan DX 1600 Bagger"]) {
      assert.equal(matchModel(card), null, card);
    }
  });
});

describe("the owner's model list of 2026-11-07", () => {
  const LIST: [string, string][] = [
    ["Doosan DX55W Mobilbagger", "doosan-dx55"],
    ["Doosan DX57W Mobilbagger", "doosan-dx57"],
    ["Daewoo Solar 55W Bagger", "solar-55"],
    ["Solar 130W-V Bagger", "solar-130"],
    ["Daewoo Solar 130 W iii Mobilbagger", "solar-130"],
    ["Daewoo Solar 130 W ii Mobilbagger", "solar-130"],
    ["Daewoo S130W-III wheel excavator", "solar-130"],
    ["Solar 130LC-V Kettenbagger", "solar-130"],
    ["Doosan DH130W Mobilbagger", "doosan-dh130"],
    ["Solar 140W-V Mobilbagger", "solar-140"],
    ["Doosan 140-WV Mobilbagger", "doosan-dx140"],
    ["Doosan DX140W-5 Mobilbagger", "doosan-dx140"],
    ["Doosan DX 140 Bagger", "doosan-dx140"],
    ["Doosan DX160W Mobilbagger", "doosan-dx160"],
    ["Doosan DX170W-5 Mobilbagger", "doosan-dx170"],
    ["Doosan DX 170 Bagger", "doosan-dx170"],
    ["Doosan DX190W Mobilbagger", "doosan-dx190"],
    ["Solar 170W-III Mobilbagger", "solar-170"],
    ["Daewoo Solar 80 W ii Bagger", "solar-80"],
    ["Daewoo Solar 80 W iii Bagger", "solar-80"],
    ["Solar 225LC-V Kettenbagger", "solar-225"],
    ["Solar 225LCV Kettenbagger", "solar-225"],
    ["Doosan DX225LC-5 Kettenbagger", "doosan-dx225"],
    ["Doosan DX210W Mobilbagger", "doosan-dx210"],
    ["Solar 300LCV Kettenbagger", "solar-300"],
    ["Doosan DX300LC Kettenbagger", "doosan-dx300"],
    ["Hyundai Robex 130W-3 Mobilbagger", "hyundai-130"],
    ["Hyundai Robex 140W-7 Mobilbagger", "hyundai-140"],
    ["Hyundai Robex 140W-9 Mobilbagger", "hyundai-140"],
    ["Hyundai Robex 55W Bagger", "hyundai-55"],
    ["Volvo EW170KR Mobilbagger", "volvo-ew170"],
    ["Volvo EW 170 Mobilbagger", "volvo-ew170"],
    ["Hitachi EX100WD-3 Mobilbagger", "hitachi-ex100"],
    ["Hitachi EX 100 Kettenbagger", "hitachi-ex100"],
    ["Hitachi EX60WD Mobilbagger", "hitachi-ex60"],
    ["Hitachi EX60-3 Kettenbagger", "hitachi-ex60"],
    ["Hitachi EX120-5 Kettenbagger", "hitachi-ex120"],
    ["Hitachi EX160WD Mobilbagger", "hitachi-ex160"],
    ["Caterpillar 120H Motor Grader", "cat-120"],
    ["Cat 120 Grader", "cat-120"],
    ["CAT 130G Grader", "cat-130"],
    ["Caterpillar 140H", "cat-140"],
    ["Cat 140 Motorgrader", "cat-140"],
    ["Caterpillar 966G II Radlader", "cat-966g2"],
    ["CAT 966G2 wheel loader", "cat-966g2"],
    ["Caterpillar 966G Radlader", "cat-966g2"],
    ["Caterpillar 980G wheel loader", "cat-980g2"],
    ["Cat 966 G Series 2 Radlader", "cat-966g2"],
    ["Caterpillar 972G II Radlader", "cat-972g2"],
    ["Caterpillar 980G II wheel loader", "cat-980g2"],
    ["Caterpillar 970F Radlader", "cat-970f"],
    ["Caterpillar 966F II Radlader", "cat-966f2"],
    ["Caterpillar 980H Radlader", "cat-980h"],
    ["Caterpillar 972H Radlader", "cat-972h"],
    ["Samsung MX6W-2 Bagger", "samsung-mx6"],
    ["Samsung MX132W Mobilbagger", "samsung-mx132"],
    ["Samsung 130 W-3 Bagger 1994", "samsung-130"],
    ["Sumsung 130W-3 excavator", "samsung-130"],
    ["JCB JS145 Kettenbagger", "jcb-js145"],
    ["JCB JS-140 Kettenbagger", "jcb-js140"],
    ["Dynapac CA2510 Walze", "dynapac-ca2510"],
    ["Dynapec CA 2510", "dynapac-ca2510"],
    ["Dynapac CC 1200 Tandemwalze", "dynapac-roller"],
    ["Dynapac Walzenzug", "dynapac-roller"],
  ];

  it("finds every machine on it, however it is written", () => {
    for (const [card, key] of LIST) {
      const decision = classify(card, ["de"]);
      assert.equal(decision.model?.key, key, `${card} (${decision.reason})`);
      assert.equal(matchModel(card, ["en"])?.key, key, `${card} on an English source`);
    }
  });

  it("every key is unique", () => {
    assert.equal(new Set(WANTED.map((m) => m.key)).size, WANTED.length);
  });

  it("keeps out what only looks like it", () => {
    for (const card of [
      "Caterpillar 966H Radlader",
      "Caterpillar 966M XE Radlader",
      "Caterpillar 950H 980 h Radlader", // hours, not a model
      "Caterpillar 320 Bagger 140 PS",
      "Cat 120B Bagger",
      "Cat 140 Bagger",
      "Samsung Galaxy S23 Ultra 130W Ladegerät",
      "Hitachi Flex 60 Bagger",
      "Hitachi EX1200 Bagger",
      "Hitachi EX160 Bagger",
      "Volvo EW160 Mobilbagger",
      "Volvo EC170 Kettenbagger",
      "Dynapac F1000 Asphaltfertiger",
      "Hyundai R170W-9 Mobilbagger",
      "Hyundai 170 W Mobilbagger",
      "Doosan DX 150 W Bagger",
      "JCB JS160 Bagger",
      "Doosan 140 PS Bagger",
      "Radlader Doosan DX140",
    ]) {
      assert.equal(matchModel(card, ["de"]), null, card);
    }
  });

  it("a wheel loader word no longer stops a wheel loader, on a source in that language", () => {
    assert.equal(matchModel("Radlader Caterpillar 966G II", ["de"])?.key, "cat-966g2");
    assert.equal(matchModel("Wheel loader CAT 972H", ["en"])?.key, "cat-972h");
  });

  it("'motor grader' is a machine, not an engine", () => {
    assert.equal(matchModel("Motor Grader Cat 140", ["de"])?.key, "cat-140");
    assert.equal(matchModel("Motor Cat 140H", ["de"]), null, "names no machine, so it stays an engine ad");
    assert.equal(matchModel("Motor Doosan DX140", ["de"]), null);
  });

  it("JCB only up to 20k, counting the expected discount as the budget filter does", () => {
    const js145 = WANTED.find((m) => m.key === "jcb-js145")!;
    const noLimits = { maxPrice: null, maxYear: null };
    assert.ok(withinLimits({ priceEur: 20_000, year: 2010 }, noLimits, js145));
    assert.ok(withinLimits({ priceEur: 25_000, year: 2010 }, noLimits, js145), "20% off reaches 20k");
    assert.equal(withinLimits({ priceEur: 25_100, year: 2010 }, noLimits, js145), false);
    assert.ok(withinLimits({ priceEur: null, year: 2010 }, noLimits, js145), "no price: kept, as with the general limit");
  });

  it("Samsung only from 1990 to 2000", () => {
    const mx = WANTED.find((m) => m.key === "samsung-mx132")!;
    const noLimits = { maxPrice: null, maxYear: null };
    assert.ok(withinLimits({ priceEur: 9000, year: 1994 }, noLimits, mx));
    assert.equal(withinLimits({ priceEur: 9000, year: 1989 }, noLimits, mx), false);
    assert.equal(withinLimits({ priceEur: 9000, year: 2001 }, noLimits, mx), false);
    assert.ok(withinLimits({ priceEur: 9000, year: null }, noLimits, mx));
  });

  it("the Mobilbagger setting leaves alone what is not only wheeled", () => {
    const fits = (card: string) => {
      const model = matchModel(card, ["de"]);
      assert.ok(model, card);
      return fitsMobileOnly(model, card, card);
    };
    for (const card of ["Caterpillar 966G II Radlader", "Cat 140 Grader", "Dynapac CA2510 Walze", "Hitachi EX60 Kettenbagger", "JCB JS145 Kettenbagger", "Solar 225LC-V Kettenbagger", "Doosan DX225LC Kettenbagger"]) {
      assert.ok(fits(card), card);
    }
    for (const card of ["Doosan DX140LC Kettenbagger", "Hyundai R140LC-9 Kettenbagger", "Doosan DX 170 LC Bagger"]) {
      assert.equal(fits(card), false, card);
    }
    for (const card of ["Doosan DX 170 W", "Volvo EW170", "Samsung MX132W", "Hitachi EX160WD", "Solar 140W-V", "Doosan 140-WV"]) {
      assert.ok(fits(card), card);
    }
  });

  it("a grader or loader is not called wheeled", () => {
    assert.equal(isWheeled("Caterpillar 966G II Radlader"), false);
    assert.equal(isWheeled("Caterpillar 140H Grader"), false);
  });
});

describe("sources", () => {
  it("every source declares known languages", () => {
    for (const s of SOURCES) {
      assert.ok(s.languages.length > 0, s.id);
      for (const code of s.languages) assert.ok(LANGUAGES[code], `${s.id}: ${code}`);
    }
  });

  it("the four original sources keep exactly the German filters", () => {
    for (const id of ["maschinensucher", "truckscout24", "kleinanzeigen", "machineryline"]) {
      const s = SOURCES.find((x) => x.id === id)!;
      assert.deepEqual(s.languages, ["de"], id);
      assert.equal(s.defaultCountry, "Deutschland", id);
    }
  });
});
