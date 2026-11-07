import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatCountdown, isIntervalChoice, nextRun } from "../lib/schedule";

const NOW = Date.parse("2026-11-07T10:00:00.000Z");
const minutesAgo = (m: number) => NOW - m * 60_000;

describe("nextRun", () => {
  it("is one interval after the last scrape started, not after now", () => {
    assert.deepEqual(nextRun(minutesAgo(40), 60, NOW), { nextRunAt: "2026-11-07T10:20:00.000Z", intervalMinutes: 60 });
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
