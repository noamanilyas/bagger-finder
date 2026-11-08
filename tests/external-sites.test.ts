import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeSite, parseExternalSites, siteDue, siteOfUrl } from "../lib/external-sites";
import { applyChange, DEFAULT_SETTINGS } from "../lib/settings";

describe("normalizeSite", () => {
  it("reduces addresses and names to the host without www", () => {
    assert.equal(normalizeSite("mobile.de"), "mobile.de");
    assert.equal(normalizeSite(" https://www.Mobile.de/fahrzeuge?x=1 "), "mobile.de");
    assert.equal(normalizeSite("abc.com/path"), "abc.com");
  });

  it("refuses what is not a host name", () => {
    assert.equal(normalizeSite("mobile"), null);
    assert.equal(normalizeSite(""), null);
    assert.equal(normalizeSite(42), null);
  });
});

describe("siteOfUrl", () => {
  const sites = [
    { site: "mobile.de", intervalMinutes: 60 },
    { site: "suchen.mobile.de", intervalMinutes: 10 },
    { site: "abc.com", intervalMinutes: 5 },
  ];

  it("finds the listed site of an address, the most specific first", () => {
    assert.equal(siteOfUrl("https://www.mobile.de/ad/1", sites)?.site, "mobile.de");
    assert.equal(siteOfUrl("https://suchen.mobile.de/ad/1", sites)?.site, "suchen.mobile.de");
    assert.equal(siteOfUrl("https://shop.abc.com/1", sites)?.site, "abc.com");
  });

  it("does not match a site that merely ends the same way", () => {
    assert.equal(siteOfUrl("https://notabc.com/1", sites), null);
  });
});

describe("parseExternalSites", () => {
  it("cleans the names and keeps one entry per site", () => {
    assert.deepEqual(
      parseExternalSites([
        { site: "www.mobile.de", intervalMinutes: 60 },
        { site: "mobile.de", intervalMinutes: 30 },
      ]),
      [{ site: "mobile.de", intervalMinutes: 30 }],
    );
  });

  it("refuses bad names and intervals", () => {
    assert.match(String(parseExternalSites([{ site: "nope", intervalMinutes: 5 }])), /site name/);
    assert.match(String(parseExternalSites([{ site: "abc.com", intervalMinutes: 0 }])), /intervalMinutes/);
    assert.match(String(parseExternalSites([{ site: "abc.com", intervalMinutes: 1.5 }])), /intervalMinutes/);
    assert.match(String(parseExternalSites([{ site: "abc.com", intervalMinutes: 2000 }])), /intervalMinutes/);
    assert.match(String(parseExternalSites("abc.com")), /list/);
  });
});

describe("siteDue", () => {
  const sites = [{ site: "mobile.de", intervalMinutes: 60 }];
  const now = Date.parse("2026-11-08T12:00:00Z");

  it("is due when the site was never received", () => {
    const d = siteDue("mobile.de", sites, {}, now);
    assert.equal(d.due, true);
    assert.equal(d.nextDueAt, null);
  });

  it("is not due within the interval, and says when it will be", () => {
    const d = siteDue("https://www.mobile.de", sites, { "mobile.de": "2026-11-08T11:50:00Z" }, now);
    assert.equal(d.site, "mobile.de");
    assert.equal(d.due, false);
    assert.equal(d.nextDueAt, "2026-11-08T12:50:00.000Z");
  });

  it("is due again once the interval has passed", () => {
    assert.equal(siteDue("mobile.de", sites, { "mobile.de": "2026-11-08T11:00:00Z" }, now).due, true);
  });

  it("is never due for a site that is not listed", () => {
    const d = siteDue("abc.com", sites, {}, now);
    assert.equal(d.listed, false);
    assert.equal(d.due, false);
  });
});

describe("applyChange externalSites", () => {
  it("replaces the list with the one sent", () => {
    const current = { ...DEFAULT_SETTINGS, externalSites: [{ site: "abc.com", intervalMinutes: 5 }] };
    const next = applyChange(current, { externalSites: [{ site: "https://mobile.de", intervalMinutes: 10 }] }, []);
    assert.ok(typeof next === "object");
    assert.deepEqual(next.externalSites, [{ site: "mobile.de", intervalMinutes: 10 }]);
  });

  it("refuses an invalid list", () => {
    assert.equal(typeof applyChange(DEFAULT_SETTINGS, { externalSites: [{ site: "x", intervalMinutes: 5 }] }, []), "string");
  });
});
