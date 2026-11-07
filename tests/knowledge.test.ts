import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { commentText, notesFor, suggestedMaxPrice, validateNote, withKnowledge, type KnowledgeNote } from "../lib/knowledge";
import type { Listing } from "../lib/types";

const listing = (over: Partial<Listing>) =>
  ({ id: "1", title: "Yanmar B 55W-2", model: "B 55W-2", modelKey: "yanmar-55", wheeled: true, priceEur: 25600, adType: "sale", ...over }) as Listing;

const b55w: KnowledgeNote = { id: 1, interesting: true, listingId: null, modelKey: "yanmar-55", wheeled: true, modelContains: "b55w", maxPriceEur: 30000, note: "We bought one" };

const matches = (over: Partial<Listing>, note = b55w) => notesFor(listing(over), [note]).length === 1;

describe("notesFor", () => {
  it("matches the machine the note is about, however the name is written", () => {
    assert.ok(matches({}));
    assert.ok(matches({ title: "Yanmar B55 W-1 Mobilbagger", model: null }));
    assert.ok(matches({ title: "YANMAR B-55W", model: null }));
  });

  it("does not match another model of the same key", () => {
    assert.ok(!matches({ title: "Yanmar Vio 55", model: "Vio 55" }));
    assert.ok(!matches({ modelKey: "hyundai-55" }));
  });

  it("respects wheeled, with empty meaning both", () => {
    assert.ok(!matches({ wheeled: false }));
    assert.ok(matches({ wheeled: false }, { ...b55w, wheeled: null }));
  });

  it("stops at the price limit and needs a price when there is one", () => {
    assert.ok(matches({ priceEur: 30000 }));
    assert.ok(!matches({ priceEur: 30001 }));
    assert.ok(!matches({ priceEur: null }));
    assert.ok(matches({ priceEur: null }, { ...b55w, maxPriceEur: null }));
  });

  it("ignores rentals and parts", () => {
    assert.ok(!matches({ adType: "rental" }));
    assert.ok(!matches({ adType: "parts" }));
    assert.ok(matches({ adType: null }));
  });

  it("keeps a comment on one ad to that ad, whatever its model or price", () => {
    const oneAd = { ...b55w, listingId: "ad1" };
    assert.ok(matches({ id: "ad1", title: "Something else", model: null, modelKey: "hyundai-55", wheeled: false, priceEur: 99999 }, oneAd));
    assert.ok(!matches({ id: "ad2" }, oneAd));
  });
});

describe("withKnowledge", () => {
  it("adds notes with their ids only to matching ads", () => {
    const [hit, miss] = withKnowledge([listing({}), listing({ id: "2", priceEur: 39865 })], [b55w]);
    assert.deepEqual(hit.knowledge, [{ id: 1, note: "We bought one", interesting: true, thisAdOnly: false }]);
    assert.equal(miss.knowledge, undefined);
  });

  it("says which comments are on one ad and which only comment", () => {
    const [hit] = withKnowledge([listing({})], [{ ...b55w, interesting: false, listingId: "1" }]);
    assert.deepEqual(hit.knowledge, [{ id: 1, note: "We bought one", interesting: false, thisAdOnly: true }]);
  });
});

describe("validateNote", () => {
  const keys = ["yanmar-55"];
  const good = { modelKey: "yanmar-55", wheeled: true, modelContains: " b55w ", maxPriceEur: 30000, note: " Good " };

  it("tidies a good note", () => {
    assert.deepEqual(validateNote(good, keys), {
      interesting: false,
      listingId: null,
      modelKey: "yanmar-55",
      wheeled: true,
      modelContains: "b55w",
      maxPriceEur: 30000,
      note: "Good",
    });
  });

  it("treats missing limits as no limit, and a comment as not interesting unless marked", () => {
    const n = validateNote({ modelKey: "yanmar-55", note: "Good" }, keys);
    assert.deepEqual([n.wheeled, n.modelContains, n.maxPriceEur, n.interesting, n.listingId], [null, null, null, false, null]);
  });

  it("drops the limits on a comment for one ad, since they would not be used", () => {
    const n = validateNote({ ...good, interesting: true, listingId: "5ff75a5f81d74768" }, keys);
    assert.deepEqual([n.wheeled, n.modelContains, n.maxPriceEur, n.interesting, n.listingId], [null, null, null, true, "5ff75a5f81d74768"]);
  });

  it("does not let a name part of only spaces or hyphens pass as a limit", () => {
    assert.equal(validateNote({ ...good, modelContains: " - " }, keys).modelContains, null);
  });

  for (const [what, bad] of [
    ["an unknown model", { modelKey: "cat-320" }],
    ["an empty note", { note: "   " }],
    ["a very long note", { note: "x".repeat(501) }],
    ["a price that is not a number", { maxPriceEur: "lots" }],
    ["a price that was not a number on the command line", { maxPriceEur: Number.NaN }],
    ["a zero price", { maxPriceEur: 0 }],
    ["a wheeled value that is not true or false", { wheeled: "yes" }],
    ["an interesting value that is not true or false", { interesting: "yes" }],
    ["an ad id that is not an id", { listingId: "a b;c" }],
  ] as const) {
    it(`refuses ${what}`, () => assert.throws(() => validateNote({ ...good, ...bad }, keys)));
  }

  it("refuses no input at all", () => assert.throws(() => validateNote(null, keys)));
});

describe("commentText", () => {
  const ad = { title: "Yanmar B 55W-2", year: 2010, priceEur: 25600 };

  it("names the machine when marked interesting with nothing added", () => {
    assert.equal(commentText(ad, [], "  ", false), "Marked interesting: Yanmar B 55W-2, 2010, €25,600.");
  });

  it("keeps the owner's words as they are on one ad", () => {
    assert.equal(commentText(ad, ["Good engine"], "We bought one", false), "Good engine. We bought one");
  });

  it("says which ad a comment on similar machines came from", () => {
    assert.equal(commentText(ad, ["Good price"], "", true), "Good price. (on Yanmar B 55W-2, 2010, €25,600)");
  });

  it("leaves out what the ad does not say", () => {
    assert.equal(commentText({ title: "Yanmar B55W", year: null, priceEur: null }, [], "", true), "Marked interesting: Yanmar B55W.");
  });

  it("always passes validation at the longest comment the form allows", () => {
    const note = commentText({ ...ad, title: "x".repeat(300) }, ["Good price", "Good model", "Good engine"], "y".repeat(300), true);
    assert.ok(validateNote({ modelKey: "yanmar-55", note }, ["yanmar-55"]));
  });
});

describe("suggestedMaxPrice", () => {
  it("is the price plus 10%, rounded up to the next thousand", () => assert.equal(suggestedMaxPrice(25600), 29000));
  it("has no suggestion without a price", () => assert.equal(suggestedMaxPrice(null), null));
});
