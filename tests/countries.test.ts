import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COUNTRIES, countryOf, expandCountryCode, isExcludedPlace } from "../lib/countries";
import { LEGACY_EUROPE, LEGACY_NON_EUROPE } from "./legacy-filters";

const LEGACY_PLACES = [
  "Brasschaat, Belgien",
  "Kužiai, Litauen",
  "Tarcea, Bihor, Rumänien",
  "Klundert, Niederlande",
  "Jordanow, Polen",
  "Prag, Tschechische Republik",
  "Wien, Österreich",
  "Istanbul, Türkei",
  "Moskau, Russland",
  "Minsk, Weißrussland",
  "Seoul, Südkorea",
  "Dubai, Vereinigte Arabische Emirate",
  "Shanghai, China",
];

describe("country table", () => {
  it("knows every place the old lists recognised, in the same region", () => {
    for (const place of LEGACY_PLACES) {
      const country = countryOf(place);
      assert.ok(country, place);
      assert.equal(country.region === "excluded", LEGACY_NON_EUROPE.test(place), place);
      assert.equal(country.region === "europe", LEGACY_EUROPE.test(place) && !LEGACY_NON_EUROPE.test(place), place);
    }
  });

  it("reads names in other languages and in capitals", () => {
    assert.equal(countryOf("Kraków, Polska")?.code, "PL");
    assert.equal(countryOf("Yvelines, FRANCE")?.code, "FR");
    assert.equal(countryOf("Rotterdam, Nederland")?.code, "NL");
    assert.equal(countryOf("Praha, Cesko")?.code, "CZ");
  });

  it("catches excluded countries the old list only knew in German", () => {
    for (const place of ["Istanbul, Turkey", "Moscow, Russia", "Mumbai, India", "Kowloon, Hong Kong", "Kathmandu, Nepal"]) {
      assert.equal(isExcludedPlace(place), true, place);
      assert.equal(LEGACY_NON_EUROPE.test(place), false, `${place}: the old list missed this, which is why it changed`);
    }
  });

  it("no longer mistakes a town for a country", () => {
    assert.equal(LEGACY_NON_EUROPE.test("Tirana, Albanien"), true, "the old list saw 'iran' inside 'Tirana'");
    assert.equal(isExcludedPlace("Tirana, Albanien"), false);
    assert.equal(isExcludedPlace("Jordanow, Polen"), false);
    assert.equal(countryOf("Neu Polen, Deutschland")?.code, "DE");
  });

  it("leaves an unnamed place unknown", () => {
    assert.equal(countryOf("12681 Berlin"), null);
    assert.equal(countryOf(null), null);
  });

  it("has unique codes", () => {
    const codes = COUNTRIES.map((c) => c.code);
    assert.equal(new Set(codes).size, codes.length);
  });
});

describe("country codes", () => {
  it("expands codes for sites known to print them", () => {
    assert.equal(expandCountryCode("Siegen, Nordrhein-Westfalen, DE"), "Siegen, Nordrhein-Westfalen, Germany");
    assert.equal(expandCountryCode("-, DE"), "Germany");
    assert.equal(expandCountryCode("Antwerpen, BE"), "Antwerpen, Belgium");
    assert.equal(expandCountryCode("Shanghai, CN"), "Shanghai, China");
    assert.equal(isExcludedPlace(expandCountryCode("Shanghai, CN")), true);
    assert.equal(expandCountryCode("Vilnius, Vilniaus apskritis, LT, LT"), "Vilnius, Vilniaus apskritis, Lithuania");
  });

  it("leaves other places alone", () => {
    assert.equal(expandCountryCode("12681 Berlin"), "12681 Berlin");
    assert.equal(expandCountryCode("Essen, ZZ"), "Essen, ZZ");
    assert.equal(expandCountryCode(null), null);
  });

  it("does not read codes unless asked: BY is Bavaria in Germany", () => {
    assert.equal(countryOf("München, BY"), null);
    assert.equal(isExcludedPlace("München, BY"), false);
  });
});
