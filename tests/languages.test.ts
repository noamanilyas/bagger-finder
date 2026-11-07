import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { SOURCES, classify, isWheeled, matchModel } from "../lib/config";
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
