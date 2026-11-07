/** The national sites' card parsers, on real cards of 2026-11-07, and the pieces they rely on. */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { SOURCES, matchModel, seedUrls } from "../lib/config";
import { findPrice, setEurRates, toEur } from "../lib/currency";
import { priceChanged } from "../lib/history";
import { afterBlock, isResting, parseRetryAfter, restMs } from "../lib/source-health";
import { blockReason } from "../scraper/blocks";
import { withoutTracking } from "../scraper/cards";
import { heuristicItem, settlePrice, type Extracted } from "../scraper/extract";
import {
  parseAdevinta,
  parseAgroinform,
  parseAutotrader,
  parseAutovit,
  parseBazosCz,
  parseBazosSk,
  parseBlocket,
  parseDba,
  parseFinn,
  parseJofogas,
  parseLandwirt,
  parseLeboncoin,
  parseMaskinbladet,
  parseNettikone,
  parseOtomoto,
  parseSubito,
} from "../scraper/parsers";
import { rulesFrom } from "../scraper/robots";

describe("national site cards", () => {
  it("Landwirt.com", () => {
    const card = parseLandwirt(
      "Gebrauchtmaschine Doosan DX57W-7 39.000 € Bj. 2019 3.378 h Schnellwechsler Baumaschinen Mobilbagger Eisenwagen Baumaschinen GmbH 2325 Himberg Baumaschinen / Doosan 28-02-2022 08:32",
    );
    assert.equal(card?.title, "Doosan DX57W-7");
    assert.equal(card?.priceAmount, 39000);
    assert.equal(card?.priceCurrency, "EUR");
    assert.equal(card?.year, 2019);
    assert.equal(card?.hours, 3378);
    assert.equal(card?.location, "2325 Himberg");
    const asked = parseLandwirt(
      "Neumaschine Doosan DX100W-7 Preis auf Anfrage 102 PS/75 kW Bj. 2023 1 h Schnellwechsler Baumaschinen Mobilbagger Eisenwagen Baumaschinen GmbH 2325 Himberg Baumaschinen / Doosan 15-11-2022 13:09",
    );
    assert.equal(asked?.priceAmount, null);
    assert.equal(asked?.priceNote, "new machine");
  });

  it("Marktplaats, 2dehands and 2ememain", () => {
    const card = parseAdevinta(
      "Bewaren in Mijn Favorieten GEZOCHT DOOSAN GRAAFMACHINES Bieden Details Ophalen of Verzenden Graafmachine Hallo goededag ik ben opzoek naar doosan graafmachines doosan dx140. Heeft u deze machines neem dan contact op met mij.ik kan u goede prijs betale... Barendrecht 2 nov 26",
    );
    assert.equal(card?.title, "GEZOCHT DOOSAN GRAAFMACHINES");
    assert.equal(card?.location, "Barendrecht");
    const priced = parseAdevinta(
      "Bewaren in Mijn Favorieten Doosan DX140W-3 (bj 2015) € 42.500,00 Details Ophalen of Verzenden Graafmachine Nette machine met 8.200 uur... Purmerend Dagtopper Vandaag",
    );
    assert.equal(priced?.priceAmount, 42500);
    assert.equal(priced?.year, 2015);
    assert.equal(priced?.hours, 8200);
    assert.equal(priced?.location, "Purmerend");
    const french = parseAdevinta(
      "Sauvegarder dans Mes Favoris Doosan DX160-7 280 uur Nieuw Staat ! Voir description Détails Enlèvement Tekoop doosan dx160-7 bouwjaar 2023 280 uur!... Arendonk Annonce au top Aujourd'hui",
    );
    assert.equal(french?.title, "Doosan DX160-7 280 uur Nieuw Staat !");
    assert.equal(french?.location, "Arendonk");
  });

  it("Bazoš", () => {
    const cz = parseBazosCz(
      "Prodám kolové rýpadlo Hyundai R140W-7 - TOP - [7.11. 2026] Rok výroby: 2008, 11 500 mth, po servisu ... 1 100 000 Kč Trutnov 541 01 128 x Označit špatný inzerát Chybnou kategorii",
    );
    assert.equal(cz?.title, "Prodám kolové rýpadlo Hyundai R140W-7");
    assert.deepEqual([cz?.priceAmount, cz?.priceCurrency], [1100000, "CZK"]);
    assert.equal(cz?.location, "541 01 Trutnov");
    assert.equal(cz?.year, 2008);
    assert.equal(cz?.hours, 11500);
    const sk = parseBazosSk("Predám LYŽICU na VZV - TOP - [7.11. 2026] Predám novú lyžicu ... 900 € Trnava 917 01 327 x Označiť zlý inzerát");
    assert.deepEqual([sk?.priceAmount, sk?.priceCurrency, sk?.location], [900, "EUR", "917 01 Trnava"]);
    const agreed = parseBazosSk("Kultivátor na bager - [7.11. 2026] Predám robustné zariadenie ... Dohodou Banská Bystrica 974 05 44 x Označiť zlý inzerát");
    assert.deepEqual([agreed?.priceAmount, agreed?.location], [null, "974 05 Banská Bystrica"]);
  });

  it("Otomoto and Autovit", () => {
    const pl = parseOtomoto(
      "1 / 3 Doosan DX55-9C 2018 Doosan - DX55-9C Wyróżnione year 2018 Stare Miasto (Wielkopolskie) Firma • Opublikowano Zobacz ogłoszenia Bud Okasion ad link 2018 47 080 PLN",
    );
    assert.equal(pl?.title, "Doosan DX55-9C 2018 Doosan - DX55-9C");
    assert.deepEqual([pl?.priceAmount, pl?.priceCurrency, pl?.year], [47080, "PLN", 2018]);
    assert.equal(pl?.location, "Stare Miasto, Wielkopolskie");
    const ro = parseAutovit(
      "Doosan DX255LC-6, 2020, 10.849h, 25,5 tone PROMOTIE 50.900 EUR+Tva Promovat year 2020 Chitila (Ilfov) Profesionist • Reactualizat Vezi anunțurile ad link 2020 61 589 EUR ( 50 900 EUR - net ) Calculeaza rata",
    );
    assert.deepEqual([ro?.priceAmount, ro?.priceCurrency], [61589, "EUR"]);
    assert.equal(ro?.priceNote, "net €50.900 (excl. VAT)");
    assert.equal(ro?.hours, 10849);
    assert.equal(ro?.location, "Chitila, Ilfov");
  });

  it("Jófogás", () => {
    const card = parseJofogas(
      "Doosan DW85 1500 üó 8 17,90 M Ft 2022 • 0 km Lisztes Trans Kereskedés Berettyóújfalu 8 Doosan DW85 1500 üó 17 900 000 Ft 2022 • 0 km Lisztes Trans Kereskedés Berettyóújfalu",
    );
    assert.equal(card?.title, "Doosan DW85 1500 üó");
    assert.deepEqual([card?.priceAmount, card?.priceCurrency, card?.year, card?.hours], [17900000, "HUF", 2022, 1500]);
    assert.equal(card?.location, "Berettyóújfalu");
  });

  it("Agroinform", () => {
    const card = parseAgroinform(
      "14 Caterpillar M316D gumikerekes kotró 24.180.000 Ft +ÁFA 14 éve hirdető 2026. november 7. 18:04 • Forgógémes rakodó • Pest , Nagykőrös Kihasználatlanság miatt eladó. 14788 üzemóra, azonnal munkára fogható. Használt Gyártási év: 2013 167 LE",
    );
    assert.equal(card?.title, "Caterpillar M316D gumikerekes kotró");
    assert.deepEqual([card?.priceAmount, card?.priceCurrency, card?.year, card?.hours], [24180000, "HUF", 2013, 14788]);
    assert.equal(card?.location, "Nagykőrös, Pest");
    assert.equal(card?.priceNote, "excl. VAT");
    const eur = parseAgroinform("6 Takeuchi TB 175 W / 2012 / 5.546 h üzemóra 24.900 EUR 5 éve hirdető 2026. november 7. 14:04 • Forgógémes rakodó • Budapest , Budapest (I. kerület) Takeuchi");
    assert.deepEqual([eur?.priceAmount, eur?.priceCurrency, eur?.hours], [24900, "EUR", 5546]);
    assert.equal(eur?.location, "Budapest (I. kerület), Budapest");
  });

  it("FINN, Blocket and DBA", () => {
    const no = parseFinn("Pil til venstre Pil til høyre Bilde 1 av 30 Doosan DA 45 2021 1 585 000 kr Vikersund ∙ Rental Group Trading AS Forhandler ∙ 9 775 timer Legg til som favoritt Gå til annonsen");
    assert.equal(no?.title, "Doosan DA 45");
    assert.deepEqual([no?.priceAmount, no?.priceCurrency, no?.year, no?.hours, no?.location], [1585000, "NOK", 2021, 9775, "Vikersund"]);
    const unpriced = parseFinn("Pil til venstre Pil til høyre Bilde 1 av 22 Doosan DX140LCR-5 2020 Hell ∙ Rockmann AS Forhandler ∙ 3 115 timer Legg til som favoritt");
    assert.deepEqual([unpriced?.title, unpriced?.priceAmount, unpriced?.location, unpriced?.hours], ["Doosan DX140LCR-5", null, "Hell", 3115]);
    const se = parseBlocket("Pil vänster Pil höger Bild 1 av 4 Yanmar Minigrävare V 10 12 1,2 Ton NY 2023 323 750 kr 259 000 kr exkl. moms Sundsvall ∙ X-maskiner AB Västernorrland Företag 1 dag");
    assert.deepEqual([se?.priceAmount, se?.priceCurrency, se?.location], [323750, "SEK", "Sundsvall"]);
    assert.equal(se?.priceNote, "net 259.000 SEK (excl. VAT)");
    const dk = parseDba("153.000 kr. Gumminged Doosan DL420 med trykkabine Tølløse 5 dage Klaravik Danmark Føj til favoritter Gå til annoncen");
    assert.deepEqual([dk?.title, dk?.priceAmount, dk?.priceCurrency, dk?.location], ["Gumminged Doosan DL420 med trykkabine", 153000, "DKK", "Tølløse"]);
  });

  it("Maskinbladet", () => {
    const card = parseMaskinbladet(
      "Doosan DL420-5 God og solid gummiged klar til nye udfordringer. Scania motor DC13 med 345 hk... 7300 Jelling Årgang: 2015 Timer: 10973 HK: 345.00 Pris: DKK 495.000,- ekskl. moms Favorit Favorit",
    );
    assert.equal(card?.title, "Doosan DL420-5");
    assert.deepEqual([card?.priceAmount, card?.priceCurrency, card?.year, card?.hours], [495000, "DKK", 2015, 10973]);
    assert.equal(card?.location, "7300 Jelling");
    assert.equal(card?.priceNote, "excl. VAT");
  });

  it("Nettikone", () => {
    const card = parseNettikone(
      "Lisää vertailuun Video Icon 1 1 1 1 1 1 1 1 1 Doosan DX 255 LC 45 000 € (ALV väh. kelp.) 2010 13 287 h Ota yhteyttä LIIKE Kitee › Väkevä",
    );
    assert.equal(card?.title, "Doosan DX 255 LC");
    assert.deepEqual([card?.priceAmount, card?.priceCurrency, card?.year, card?.hours, card?.location], [45000, "EUR", 2010, 13287, "Kitee"]);
    assert.equal(card?.priceNote, "VAT deductible");
  });

  it("Subito", () => {
    const card = parseSubito("Vetrina Doosan 22.000 € Balestrate ( PA )");
    assert.deepEqual([card?.title, card?.priceAmount, card?.location], ["Doosan", 22000, "Balestrate, PA"]);
    const unpriced = parseSubito("Vetrina MINIESCAVATORE DOOSAN DX85R - 3 Catania ( CT )");
    assert.deepEqual([unpriced?.title, unpriced?.priceAmount, unpriced?.location], ["MINIESCAVATORE DOOSAN DX85R - 3", null, "Catania, CT"]);
  });

  it("Leboncoin", () => {
    const card = parseLeboncoin(
      'Doosan DX27Z 17 880 € 14 900 € HT Prix: 17 880 €.. 14 900 € hors taxes. Pro Vendeur professionnel. · Pelle · 2018 Type de matériel: "Pelle". Année: "2018" TIPMAT Grandchamps-des-Fontaines 44119 Située à Grandchamps-des-Fontaines 44119.',
    );
    assert.equal(card?.title, "Doosan DX27Z");
    assert.deepEqual([card?.priceAmount, card?.year, card?.location], [17880, 2018, "44119 Grandchamps-des-Fontaines"]);
    assert.equal(card?.priceNote, "net €14.900 (excl. VAT)");
  });

  it("Autotrader Plant", () => {
    const card = parseAutotrader("Xcmg XE60E £22,750 +VAT 2026 New Unused XCMG XE60E 6 Tonne machine (Full Spec) On New 600mm Pads");
    assert.deepEqual([card?.title, card?.priceAmount, card?.priceCurrency, card?.year, card?.priceNote], ["Xcmg XE60E", 22750, "GBP", 2026, "excl. VAT"]);
    const poa = parseAutotrader("Volvo ECR88D 2022 POA +VAT 2022 Volvo ECR88D Tracked Excavator Sold by Ritchie Bros - (EquipID:16192066) - Located in MALTBY-GBR");
    assert.deepEqual([poa?.priceAmount, poa?.location], [null, "Maltby, United Kingdom"]);
  });
});

describe("national site cards: mistakes seen on live pages", () => {
  it("a model's hyphen and digit are no part of the hours", () => {
    const card = parseAdevinta("Sauvegarder dans Mes Favoris Doosan DX160-7 280 uur Nieuw Staat ! Voir description Détails Enlèvement bouwjaar 2023... Arendonk Aujourd'hui");
    assert.equal(card?.hours, 280);
  });

  it("the town follows the last cut-off description", () => {
    const card = parseAdevinta(
      "Bewaren in Mijn Favorieten Doosan DX140W-3 (bj 2015) € 68.750,00 Details Graafmachine Doosan dx140w-3 algemene informatie type: wielgra... Kootwijkerbroek 4 nov 26",
    );
    assert.equal(card?.location, "Kootwijkerbroek");
  });

  it("a card opening with its year still has a title, and the seller's kind is no part of the town", () => {
    const card = parseFinn(
      "Pil til venstre Pil til høyre Bilde 1 av 30 2008 Doosan DX 140 LC m/ rotortilt og pusseskuffe. SE VIDEO! 2008 289 000 kr Bryne ∙ LANDBRUKSSALG.NO AS Forhandler Legg til som favoritt",
    );
    assert.equal(card?.title, "2008 Doosan DX 140 LC m/ rotortilt og pusseskuffe. SE VIDEO!");
    assert.deepEqual([card?.year, card?.priceAmount, card?.location], [2008, 289000, "Bryne"]);
    const privat = parseFinn("Bilde 1 av 3 Doosan DX 60 9c 2024 350 000 kr Gratangen Privat ∙ 500 timer");
    assert.equal(privat?.location, "Gratangen");
  });

  it("Nettikone's photo counters are no part of the title", () => {
    assert.equal(parseNettikone("1 1 1 1 1 Doosan DX300 pitkät puomit 23 500 € 2012 Ota yhteyttä Riihimäki")?.title, "Doosan DX300 pitkät puomit");
  });

  it("a placeholder price is no price, and says what was listed", () => {
    setEurRates({ PLN: 4.4 });
    const source = SOURCES.find((s) => s.id === "otomoto")!;
    const item = heuristicItem(
      { href: "https://www.otomoto.pl/maszyny-budowlane/oferta/cat-ID1.html", img: null, text: "Caterpillar CAT 972G SERIES II year 2001 Strzyżew (Wielkopolskie) Firma • Opublikowano ad link 2001 1 000 PLN" },
      source,
    );
    assert.equal(item.priceEur, null);
    assert.match(item.priceNote ?? "", /listed at 1\.000 PLN/);
    setEurRates({});
  });

  it("a Bazoš ad from abroad has no place", () => {
    assert.equal(parseBazosSk("Kolový bagr Doosan DX57 - [7.11. 2026] text ... 39 200 € Zahraničie 123 45 12 x Označiť")?.location, null);
  });
});

describe("prices in other currencies", () => {
  it("finds the site's currency, or euros where it shows both", () => {
    assert.deepEqual(findPrice("Hyundai R140W 1 100 000 Kč Trutnov", "CZK"), { amount: 1100000, currency: "CZK" });
    assert.deepEqual(findPrice("Hyundai R140W 23 900 € Trnava", "CZK"), { amount: 23900, currency: "EUR" });
    assert.deepEqual(findPrice("Doosan 47 080 PLN", "PLN"), { amount: 47080, currency: "PLN" });
    assert.deepEqual(findPrice("Xcmg £22,750 +VAT", "GBP"), { amount: 22750, currency: "GBP" });
    assert.equal(findPrice("Hyundai R140W 1 dag", "SEK"), null);
  });

  it("converts with the rate of the day, and gives no euros without one", () => {
    setEurRates({ PLN: 4.25 });
    assert.equal(toEur(42500, "PLN"), 10000);
    assert.equal(toEur(100000, "NOK"), null, "no NOK rate set");
    assert.equal(toEur(5000, null), 5000);
    setEurRates({});
  });

  it("settles a card's price into euros and keeps the original", () => {
    setEurRates({ DKK: 7.46 });
    const item = { url: "u", title: "t", description: null, make: null, model: null, priceEur: null, year: null, hours: null, location: null, imageUrl: null, adType: null, issues: null, priceNote: null } satisfies Extracted;
    const dkk = settlePrice({ ...item, priceAmount: 495000, priceCurrency: "DKK" }, "");
    assert.deepEqual([dkk.priceEur, dkk.priceAmount, dkk.priceCurrency], [66354, 495000, "DKK"]);
    const eur = settlePrice({ ...item, priceAmount: 39000, priceCurrency: "EUR" }, "");
    assert.deepEqual([eur.priceEur, eur.priceAmount, eur.priceCurrency], [39000, null, null]);
    const found = settlePrice(item, "Hyundai R140W 52 000 kr Odense", "DKK");
    assert.deepEqual([found.priceAmount, found.priceCurrency], [52000, "DKK"]);
    setEurRates({});
  });

  it("the parsed card of a non-euro site is in euros, ready for the price limit", () => {
    setEurRates({ CZK: 25 });
    const source = SOURCES.find((s) => s.id === "bazos-cz")!;
    const item = heuristicItem(
      { href: "https://stroje.bazos.cz/inzerat/1/x.php", img: null, text: "Kolové rýpadlo Hyundai R140W - [7.11. 2026] text ... 1 000 000 Kč Trutnov 541 01 12 x Označit" },
      source,
    );
    assert.deepEqual([item.priceEur, item.priceAmount, item.priceCurrency, item.location], [40000, 1000000, "CZK", "541 01 Trutnov"]);
    setEurRates({});
  });

  it("an exchange rate moving is no new price in the history", () => {
    const head = { id: 1, listingId: "a", priceEur: 10000, hours: 100, priceAmount: 42500 };
    assert.equal(priceChanged({ priceEur: 10150, priceAmount: 42500, priceCurrency: "PLN" }, head), false);
    assert.equal(priceChanged({ priceEur: 9500, priceAmount: 40000, priceCurrency: "PLN" }, head), true);
    // Without the stored amount (column not added yet), only a move beyond the rate's daily wobble counts.
    const old = { id: 1, listingId: "a", priceEur: 10000, hours: 100 };
    assert.equal(priceChanged({ priceEur: 10200, priceAmount: 42500, priceCurrency: "PLN" }, old), false);
    assert.equal(priceChanged({ priceEur: 9000, priceAmount: 38000, priceCurrency: "PLN" }, old), true);
    assert.equal(priceChanged({ priceEur: 10001, priceAmount: null, priceCurrency: null }, old), true, "euro prices compare exactly");
  });
});

describe("staying welcome", () => {
  it("a refusal or a bot check is a block; a normal or missing page is not", () => {
    assert.match(blockReason(403, "Access denied") ?? "", /refused \(HTTP 403/);
    assert.match(blockReason(429, "") ?? "", /HTTP 429/);
    assert.match(blockReason(200, "Just a moment...") ?? "", /bot check/);
    assert.match(blockReason(503, "Attention Required! | Cloudflare") ?? "", /bot check/);
    assert.equal(blockReason(200, "Doosan bazar - Stroje | Bazoš.cz"), null);
    assert.equal(blockReason(404, "Page not found"), null);
    assert.equal(blockReason(503, "Service Unavailable"), null);
  });

  it("a blocked site rests a day, then twice as long each time, up to a week", () => {
    const day = 24 * 60 * 60_000;
    assert.deepEqual([1, 2, 3, 4, 9].map((n) => restMs(n) / day), [1, 2, 4, 7, 7]);
    assert.equal(restMs(1, 3 * day), 3 * day, "a longer Retry-After wins");
    const now = Date.parse("2026-11-07T12:00:00Z");
    const first = afterBlock(undefined, "refused (HTTP 403)", now);
    assert.equal(first.strikes, 1);
    assert.ok(isResting(first, now + day - 1));
    assert.ok(!isResting(first, now + day + 1));
    assert.equal(afterBlock(first, "again", now).strikes, 2);
    assert.equal(parseRetryAfter("120"), 120_000);
    assert.equal(parseRetryAfter(null), null);
  });

  it("robots.txt rules and crawl delays are read", () => {
    const rules = rulesFrom("https://x.test/robots.txt", "User-agent: *\nDisallow: /*hledat=\nDisallow: /fahrzeuge/search.html\nCrawl-delay: 10\n");
    assert.equal(rules.allowed("https://x.test/inzeraty/doosan/"), true);
    assert.equal(rules.allowed("https://x.test/search?hledat=doosan"), false);
    assert.equal(rules.allowed("https://x.test/fahrzeuge/search.html?x=1"), false);
    assert.equal(rules.crawlDelaySecs, 10);
  });

  it("one card per ad where links carry tracking", () => {
    const blocks = withoutTracking(
      [
        { href: "https://a.test/ad/h_1?ref=x", text: "short", img: null },
        { href: "https://a.test/ad/h_1?ref=y", text: "the longer card text", img: "p.jpg" },
      ],
      true,
    );
    assert.deepEqual(blocks, [{ href: "https://a.test/ad/h_1", text: "the longer card text", img: "p.jpg" }]);
  });

  it("every national site pages on demand and is kept out of AI", () => {
    for (const id of ["landwirt", "marktplaats", "2dehands", "2ememain", "bazos-cz", "bazos-sk", "otomoto", "autovit", "jofogas", "agroinform", "finn", "dba", "blocket", "maskinbladet", "nettikone", "subito", "leboncoin", "autotrader"]) {
      const s = SOURCES.find((x) => x.id === id);
      assert.ok(s, id);
      assert.equal(s.ai, false, id);
      assert.equal(s.browserFallback, false, id);
      assert.ok((s.paged?.(true).length ?? 0) > 0, id);
      assert.ok(seedUrls(s, true).every((u) => s.isListing && !s.isListing(u)), `${id}: a search page must not count as an ad`);
    }
  });

  it("mobile.de is only on with API credentials, and never crawled", () => {
    const s = SOURCES.find((x) => x.id === "mobile-de")!;
    assert.equal(s.api, true);
    assert.equal(s.enabled, !!(process.env.MOBILE_DE_API_USER && process.env.MOBILE_DE_API_PASSWORD));
    assert.deepEqual(seedUrls(s, true), []);
  });
});

describe("national ads reach the model filters", () => {
  it("wheeled machines in the new languages are kept", () => {
    assert.ok(matchModel("Hjulgrävare Hyundai R140W-7", ["sv"]));
    assert.ok(matchModel("Pyöräkaivuri Doosan DX140W", ["fi"]));
    assert.ok(matchModel("Escavatore gommato Hyundai Robex 140W", ["it"]));
  });
});
