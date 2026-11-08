import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { afterQuietHours, formatCountdown, inQuietHours, isIntervalChoice, nextRun } from "../lib/schedule";
import { applyChange, DEFAULT_SETTINGS } from "../lib/settings";
import { DEFAULT_SITE_HOURS, hoursFor, isSiteDue } from "../lib/site-schedule";

const NOW = Date.parse("2026-11-07T10:00:00.000Z");
const minutesAgo = (m: number) => NOW - m * 60_000;

describe("nextRun", () => {
  it("is one interval after the last scrape started, not after now", () => {
    assert.deepEqual(nextRun(minutesAgo(40), 60, NOW), { nextRunAt: "2026-11-07T10:20:00.000Z", intervalMinutes: 60, quiet: null });
  });

  it("keeps the same time however often the server restarts", () => {
    const last = minutesAgo(10);
    assert.equal(nextRun(last, 60, NOW).nextRunAt, nextRun(last, 60, NOW + 5 * 60_000).nextRunAt);
  });

  it("is in the past when the scrape was missed, so it is due at once", () => {
    assert.ok(Date.parse(nextRun(minutesAgo(180), 60, NOW).nextRunAt) <= NOW);
  });

  it("is due now when no scrape has ever run", () => {
    assert.equal(nextRun(null, 60, NOW).nextRunAt, new Date(NOW).toISOString());
  });

  it("treats a start in the future as starting now", () => {
    assert.equal(nextRun(NOW + 3_600_000, 30, NOW).nextRunAt, "2026-11-07T10:30:00.000Z");
  });

  it("follows a changed interval", () => {
    assert.equal(nextRun(minutesAgo(40), 30, NOW).nextRunAt, "2026-11-07T09:50:00.000Z");
    assert.equal(nextRun(minutesAgo(40), 120, NOW).nextRunAt, "2026-11-07T11:20:00.000Z");
  });
});

describe("isIntervalChoice", () => {
  it("accepts the shortest and longest choice", () => {
    assert.ok(isIntervalChoice(30));
    assert.ok(isIntervalChoice(2880));
  });

  it("refuses anything else", () => {
    for (const v of [5, 29, 45, 2881, "60", null, undefined]) assert.equal(isIntervalChoice(v), false);
  });
});

describe("formatCountdown", () => {
  it("shows minutes and seconds under an hour", () => {
    assert.equal(formatCountdown(54 * 60_000 + 7_000), "54:07");
  });

  it("adds hours from one hour up", () => {
    assert.equal(formatCountdown(3_600_000), "1:00:00");
    assert.equal(formatCountdown(48 * 3_600_000), "48:00:00");
  });

  it("rounds up and stops at zero", () => {
    assert.equal(formatCountdown(1), "0:01");
    assert.equal(formatCountdown(0), "0:00");
    assert.equal(formatCountdown(-5000), "0:00");
  });
});

describe("quiet hours (German time; 7 November is UTC+1)", () => {
  const NIGHT = { from: "22:00", until: "06:00" };

  it("a run due at night waits until the quiet hours end", () => {
    // due 22:30 German time -> 06:00 the next morning
    const at = nextRun(Date.parse("2026-11-07T15:30:00.000Z"), 360, Date.parse("2026-11-07T18:00:00.000Z"), NIGHT);
    assert.equal(at.nextRunAt, "2026-11-08T05:00:00.000Z");
  });

  it("an overdue run found during the night also waits, instead of running at once", () => {
    const at = nextRun(Date.parse("2026-11-07T10:00:00.000Z"), 360, Date.parse("2026-11-08T01:00:00.000Z"), NIGHT);
    assert.equal(at.nextRunAt, "2026-11-08T05:00:00.000Z");
  });

  it("a run due in the day is left alone, and so is everything without quiet hours", () => {
    const last = Date.parse("2026-11-07T08:00:00.000Z");
    assert.equal(nextRun(last, 360, last, NIGHT).nextRunAt, "2026-11-07T14:00:00.000Z");
    assert.equal(nextRun(Date.parse("2026-11-07T15:30:00.000Z"), 360, Date.parse("2026-11-07T18:00:00.000Z"), null).nextRunAt, "2026-11-07T21:30:00.000Z");
  });

  it("knows a window within one day and one past midnight", () => {
    assert.ok(inQuietHours(Date.parse("2026-11-07T22:30:00.000Z"), NIGHT), "23:30");
    assert.ok(inQuietHours(Date.parse("2026-11-08T04:59:00.000Z"), NIGHT), "05:59");
    assert.ok(!inQuietHours(Date.parse("2026-11-08T05:00:00.000Z"), NIGHT), "06:00");
    const lunch = { from: "12:00", until: "13:00" };
    assert.ok(inQuietHours(Date.parse("2026-11-07T11:30:00.000Z"), lunch), "12:30");
    assert.ok(!inQuietHours(Date.parse("2026-11-07T13:30:00.000Z"), lunch), "14:30");
    assert.ok(!inQuietHours(Date.parse("2026-11-07T11:30:00.000Z"), { from: "12:00", until: "12:00" }), "an empty window");
  });

  it("follows summer time too (UTC+2)", () => {
    assert.equal(afterQuietHours(Date.parse("2026-07-01T21:00:00.000Z"), NIGHT), Date.parse("2026-07-02T04:00:00.000Z"));
  });
});

describe("how often each site is read", () => {
  const NOW = Date.parse("2026-11-07T12:00:00.000Z");
  const hoursAgo = (h: number) => new Date(NOW - h * 3_600_000).toISOString();

  it("a site read every run, or never read yet, is always due", () => {
    assert.ok(isSiteDue(hoursAgo(1), 0, NOW));
    assert.ok(isSiteDue(null, 24, NOW));
  });

  it("a once-a-day site waits a day, allowing for runs that start a few minutes apart", () => {
    assert.ok(!isSiteDue(hoursAgo(18), 24, NOW));
    assert.ok(isSiteDue(hoursAgo(23.5), 24, NOW), "the run 24 h later starts a little early");
    assert.ok(!isSiteDue(hoursAgo(6), 12, NOW));
    assert.ok(isSiteDue(hoursAgo(11.5), 12, NOW), "every second run on a 6-hour schedule");
  });

  it("sites the settings do not name are read every run; the busy portals once a day", () => {
    assert.equal(hoursFor(DEFAULT_SITE_HOURS, "otomoto"), 0);
    assert.equal(hoursFor(DEFAULT_SITE_HOURS, "machineryline"), 24);
    assert.equal(hoursFor(DEFAULT_SITE_HOURS, "leboncoin"), 24);
  });
});

describe("changing the scraper settings", () => {
  const sites = ["machineryline", "otomoto"];

  it("changes only what it is given", () => {
    const next = applyChange(DEFAULT_SETTINGS, { siteHours: { otomoto: 12 } }, sites);
    assert.ok(typeof next !== "string");
    assert.equal(next.siteHours.otomoto, 12);
    assert.equal(next.siteHours.machineryline, 24, "the other sites keep their setting");
    assert.deepEqual(next.quiet, DEFAULT_SETTINGS.quiet);
    const off = applyChange(DEFAULT_SETTINGS, { quiet: null }, sites);
    assert.ok(typeof off !== "string" && off.quiet === null);
  });

  it("refuses what it cannot use", () => {
    assert.equal(typeof applyChange(DEFAULT_SETTINGS, {}, sites), "string");
    assert.match(String(applyChange(DEFAULT_SETTINGS, { quiet: { from: "25:00", until: "06:00" } }, sites)), /HH:MM/);
    assert.match(String(applyChange(DEFAULT_SETTINGS, { siteHours: { nosuchsite: 24 } }, sites)), /unknown site/);
    assert.match(String(applyChange(DEFAULT_SETTINGS, { siteHours: { otomoto: 5 } }, sites)), /not one of the choices/);
    assert.match(String(applyChange(DEFAULT_SETTINGS, { intervalMinutes: 7 }, sites)), /not one of the choices/);
  });
});
