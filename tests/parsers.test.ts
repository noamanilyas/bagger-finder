import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isExcludedPlace } from "../lib/countries";
import { heuristicItem } from "../scraper/extract";
import { parseEce, parseMascus, parseTruck1 } from "../scraper/parsers";

describe("Mascus cards", () => {
  it("reads a full card", () => {
    const card = parseMascus(
      "14 Hyundai Robex 140 W-7 Issleib-Nutzfahrzeuge Mobilbagger • 2006 • 4850h • Allensbach, Baden-Württemberg, DE • Issleib-Nutzfahrzeuge 32.500 EUR Favoriten Issleib-Nutzfahrzeuge",
    );
    assert.deepEqual(card, {
      title: "Hyundai Robex 140 W-7",
      location: "Allensbach, Baden-Württemberg, Germany",
      priceEur: 32500,
      year: 2006,
      hours: 4850,
      priceNote: null,
    });
  });

  it("drops the promotion label", () => {
    const card = parseMascus(
      "10 Top-Inserat Volvo EWR 170 E Schultes Nachf. GmbH Mobilbagger • 2022 • 3950h • Siegen, Nordrhein-Westfalen, DE • Schultes Nachf. GmbH 124.000 EUR Favoriten Schultes Nachf. GmbH",
    );
    assert.equal(card?.title, "Volvo EWR 170 E");
    assert.equal(card?.priceEur, 124000);
  });

  it("keeps a seller name with a number in it out of the price", () => {
    const card = parseMascus(
      "11 Wacker Neuson EW65 Autopark A5 Nutzfahrzeuge GmbH Mobilbagger • 2019 • 4873h • -, DE • Autopark A5 Nutzfahrzeuge GmbH 37.900 EUR Favoriten Autopark A5 Nutzfahrzeuge GmbH",
    );
    assert.equal(card?.priceEur, 37900);
    assert.equal(card?.location, "Germany");
  });

  it("handles a hidden price and a hidden town", () => {
    const card = parseMascus(
      "241 Hyundai R55W-9A De Rycke BVBA Mobilbagger • 2019 • 1530h • On request, BE • De Rycke BVBA Preis auf Anfrage Favoriten De Rycke BVBA",
    );
    assert.equal(card?.title, "Hyundai R55W-9A");
    assert.equal(card?.priceEur, null);
    assert.equal(card?.location, "Belgium");
  });

  it("never reports another currency as euros", () => {
    const card = parseMascus("5 Hyundai R140W Firma Mobilbagger • 2012 • 8000h • Poznan, PL • Firma 180.000 PLN Favoriten Firma");
    assert.equal(card?.priceEur, null);
    assert.equal(card?.priceNote, "180.000 PLN");
  });

  it("does not claim a card of another layout", () => {
    assert.equal(parseMascus("Hyundai R140W 45.000 €"), null);
  });
});

describe("Europe-Construction-Equipment cards", () => {
  it("reads a short card", () => {
    const card = parseEce("47 New Doosan wheel excavator DX165W-5 99,000 EUR Ex. VAT 2019 6076 hours 17.7 tonnes BRETAGNE TRANSPORT MANUTENTION FRANCE - Yvelines Contact More details");
    assert.deepEqual(card, {
      title: "Doosan wheel excavator DX165W-5",
      location: "Yvelines, France",
      priceEur: 99000,
      year: 2019,
      hours: 6076,
      priceNote: "excl. VAT",
    });
  });

  it("ignores the details a card runs on into", () => {
    const card = parseEce(
      "21 Komatsu wheel excavator PW180 11E0 170,000 EUR Ex. VAT 2023 1466 hours BIA NV BELGIUM - Vlaams Brabant Contact More details Bodywork : Wheel excavator | Year | Serial number Main information Year 2023 Country BELGIUM",
    );
    assert.equal(card?.title, "Komatsu wheel excavator PW180 11E0");
    assert.equal(card?.location, "Vlaams Brabant, Belgium");
    assert.equal(card?.hours, 1466);
  });

  it("is not fooled by horsepower or a seller name in capitals", () => {
    const card = parseEce(
      "16 Komatsu wheel excavator PW180-7 K Komatsu PW180 Mobile Excavator 18 Ton 156 HP Wheeled Excavator CE 19,500 EUR Ex. VAT 149 HP 2006 10656 hours 18 tonnes MOSTERT TRADING IMPORT-EXPORT BV NETHERLANDS - Noord-Brabant Contact More details",
    );
    assert.equal(card?.priceEur, 19500);
    assert.equal(card?.year, 2006);
    assert.equal(card?.hours, 10656);
    assert.equal(card?.location, "Noord-Brabant, Netherlands");
  });

  it("finds the country when the seller name repeats it", () => {
    const card = parseEce("17 New Caterpillar wheel excavator M315F 134,620 EUR Ex. VAT 2019 3790 hours BERGERAT MONNOYEUR ROMANIA ROMANIA - Ilfov Contact More details");
    assert.equal(card?.location, "Ilfov, Romania");
  });

  it("finds China, written in mixed case, so that it can be excluded", () => {
    const card = parseEce("8 Doosan wheel excavator dx210w 63,478 EUR Ex. VAT 2019 Hunan Best Technology Trade Co., Ltd China - 河南省 Contact More details Bodywork : Wheel excavator");
    assert.equal(card?.location, "河南省, China");
    assert.equal(isExcludedPlace(card?.location), true);
  });

  it("handles a hidden price", () => {
    const card = parseEce("6 Doosan wheel excavator DX210 W Price on request 2023 Yiwu Xundan e-Commerce Firm China - 黑龙江省 Contact More details");
    assert.equal(card?.title, "Doosan wheel excavator DX210 W");
    assert.equal(card?.priceEur, null);
    assert.equal(card?.year, 2023);
    assert.equal(isExcludedPlace(card?.location), true);
  });
});

describe("Truck1 cards", () => {
  it("reads a full card and ignores the other currencies", () => {
    const card = parseTruck1(
      "See all photos (5) NEW AD TOP Hyundai HW170ACR Wheel excavator 2023 460 h Germany, Zusmarshausen Published: 17hr 139 000EUR Price excl. VAT Rent ≈ 156 067 USD ≈ 115 984 GBP Fischer und Schweiger GmbH 7 Contact the seller",
    );
    assert.deepEqual(card, {
      title: "Hyundai HW170ACR Wheel excavator",
      location: "Zusmarshausen, Germany",
      priceEur: 139000,
      year: 2023,
      hours: 460,
      priceNote: "excl. VAT",
    });
  });

  it("does not read hours out of a title like '6.102h'", () => {
    const card = parseTruck1(
      "See all photos (20) Hyundai HW 180 / 6.102h / Tieflöffel / OQ70/55 / Klima Wheel excavator 2020 6102 h Germany, Burghaun 74 890EUR Price excl. VAT ≈ 84 085 USD ≈ 62 490 GBP Stefan Ebert GmbH 8 Contact the seller",
    );
    assert.equal(card?.hours, 6102);
    assert.equal(card?.priceEur, 74890);
    assert.equal(card?.location, "Burghaun, Germany");
  });

  it("handles 'Ask for price' and no hours", () => {
    const card = parseTruck1("See all photos (5) HYUNDAI HW140 Wheel excavator 2018 157 hp Italy, Bra Published: 1dReference number 032727 Ask for price COMAI SPA 12 Contact the seller");
    assert.equal(card?.priceEur, null);
    assert.equal(card?.hours, null, "157 hp is not hours");
    assert.equal(card?.year, 2018);
    assert.equal(card?.location, "Bra, Italy");
  });

  it("names the country so China can be excluded, and does not read km as hours", () => {
    const card = parseTruck1("See all photos (16) HYUNDAI 210W-9 Wheel excavator 2024 200 km China, Min Hang Qu Published: 22hr 16 313EUR ≈ 18 316 USD Shanghai Machinery Co., Ltd. Contact the seller");
    assert.equal(card?.location, "Min Hang Qu, China");
    assert.equal(card?.hours, null);
  });

  it("does not claim a card of another layout", () => {
    assert.equal(parseTruck1("Truck1 Construction machinery Excavators"), null);
  });
});

describe("general parser", () => {
  const read = (text: string, languages: ("de" | "en" | "pl")[] = ["de"], id = "any") =>
    heuristicItem({ href: "https://example.com/1", text, img: null }, { id, languages });

  it("reads German cards as before", () => {
    const item = read("12681 Berlin 25 km Hyundai R140W Mobilbagger 45.800 € Baujahr 2012 Betriebsstunden 8.500");
    assert.equal(item.priceEur, 45800);
    assert.equal(item.year, 2012);
    assert.equal(item.hours, 8500);
  });

  it("reads other ways of writing a price", () => {
    assert.equal(read("Hyundai R140W excavator 99,000 EUR").priceEur, 99000);
    assert.equal(read("Hyundai R140W excavator 45 800 €").priceEur, 45800);
    assert.equal(read("Hyundai R140W excavator € 45.800").priceEur, 45800);
    assert.equal(read("Hyundai R140W excavator EUR 45,800").priceEur, 45800);
  });

  it("does not take a year for part of a price", () => {
    assert.equal(read("Hyundai R140W excavator 2019 16 500 EUR").priceEur, 16500);
  });

  it("reads hours with separators instead of cutting them off", () => {
    assert.equal(read("Hyundai R140W excavator 6,076 h").hours, 6076);
    assert.equal(read("Hyundai R140W excavator 6 076 h").hours, 6076);
    assert.equal(read("Hyundai R140W excavator 6.076 h").hours, 6076);
  });

  it("uses the field labels of the source's language", () => {
    const item = read("Koparka kołowa Hyundai R140W Rok produkcji: 2012 8 500 mtg 180 000 PLN", ["pl"]);
    assert.equal(item.year, 2012);
    assert.equal(item.hours, 8500);
    assert.equal(item.priceEur, null, "a price in złoty must not become a price in euros");
  });
});

describe("cards of machines that are not wheeled excavators", () => {
  it("Truck1 reads other categories, and the site's own type label over the seller's words", () => {
    const grader = parseTruck1("See all photos (20) Caterpillar 140K . Grader 2012 2618 h Net weight: 17300 kg 191 hp Germany, Goch Ask for price MACHINEHANDEL LAMERS B.V. 2 Contact the seller");
    assert.equal(grader?.year, 2012);
    assert.equal(grader?.hours, 2618);
    assert.equal(grader?.location, "Goch, Germany");
    const crawler = parseTruck1("See all photos (28) JCB JS 145LC crawler excavator Crawler excavator 2016 Germany, Essen 30 000EUR Seller Contact the seller");
    assert.equal(crawler?.title, "JCB JS 145LC crawler excavator Crawler excavator");
    assert.equal(crawler?.priceEur, 30000);
  });
  it("a Caterpillar model ending in H is not operating hours", () => {
    const source = { id: "machineryline", languages: ["de" as const] };
    const item = (text: string) => heuristicItem({ href: "https://example.com/1", text, img: null }, source);
    assert.equal(item("Caterpillar 140H Grader 17 Caterpillar 140H 84.980 € Grader 2008").hours, null);
    assert.equal(item("Caterpillar 980H Radlader 82.500 € 2010 12.400 h").hours, 12400);
    assert.equal(item("Doosan DX140W Mobilbagger 45.000 € 2012 900h").hours, 900);
  });
});
