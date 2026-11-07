"use client";

import { useEffect, useState } from "react";
import { formatCountdown, INTERVAL_CHOICES, type Schedule } from "@/lib/schedule";

/** Its own component so the once-a-second tick does not redraw the list and the map. */
export default function NextScrape({ schedule, onDue }: { schedule: Schedule; onDue: () => void }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const total = schedule.intervalMinutes * 60_000;
  const nextRun = Date.parse(schedule.nextRunAt);
  const left = Math.max(0, nextRun - now);
  const due = left === 0;

  // The page has no other way to learn that a scheduled scrape began.
  useEffect(() => {
    if (!due) return;
    const t = setInterval(onDue, 5000);
    return () => clearInterval(t);
  }, [due, onDue]);

  const every = INTERVAL_CHOICES.find((c) => c.minutes === schedule.intervalMinutes)?.label;
  const at = new Date(nextRun).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });

  return (
    <div className="next-scrape" title={`Scrapes automatically every ${every}. Next: ${at}`}>
      <div className="sub">{due ? "Next scrape starting…" : `Next scrape in ${formatCountdown(left)}`}</div>
      <progress value={left} max={total} aria-label="Time until the next scrape" />
    </div>
  );
}
