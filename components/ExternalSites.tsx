"use client";

import { useState } from "react";
import { EXTERNAL_INTERVALS, normalizeSite, type ExternalSite } from "@/lib/external-sites";

const when = (iso: string) => new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });

/** Interval choices, plus the site's own value when it was set through the API to something not offered here. */
const choicesFor = (minutes: number) =>
  EXTERNAL_INTERVALS.some((c) => c.minutes === minutes) ? EXTERNAL_INTERVALS : [...EXTERNAL_INTERVALS, { minutes, label: `Every ${minutes} minutes` }];

/** The sites an external system sends to /api/ingest, and how often it should (Scraper settings). */
export default function ExternalSites({
  sites,
  lastReceived,
  disabled,
  onChange,
}: {
  sites: ExternalSite[];
  lastReceived: Record<string, string>;
  disabled: boolean;
  onChange: (sites: ExternalSite[]) => void;
}) {
  const [name, setName] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [problem, setProblem] = useState<string | null>(null);

  const add = () => {
    const site = normalizeSite(name);
    if (!site) return setProblem("Enter a site such as mobile.de");
    setProblem(null);
    setName("");
    onChange([...sites.filter((s) => s.site !== site), { site, intervalMinutes: minutes }]);
  };

  return (
    <details className="site-hours external-sites">
      <summary>External sites ({sites.length})</summary>
      <div className="sub">
        Sites another system extracts and sends to the ingest API. It asks <code>/api/ingest/due</code> first and gets “true” once this long has
        passed since the site’s machines last arrived.
      </div>
      {sites.length === 0 && <div className="sub">No sites yet.</div>}
      {sites.map((s) => (
        <div key={s.site} className="site-row">
          <span>
            {s.site}
            <span className="sub ext-last">{lastReceived[s.site] ? `last sent ${when(lastReceived[s.site])}` : "not sent yet"}</span>
          </span>
          <span className="ext-actions">
            <select
              aria-label={`How often ${s.site} is sent`}
              value={s.intervalMinutes}
              disabled={disabled}
              onChange={(e) => onChange(sites.map((x) => (x.site === s.site ? { ...x, intervalMinutes: Number(e.target.value) } : x)))}
            >
              {choicesFor(s.intervalMinutes).map((c) => (
                <option key={c.minutes} value={c.minutes}>{c.label}</option>
              ))}
            </select>
            <button className="btn ghost icon" aria-label={`Remove ${s.site}`} title="Remove" disabled={disabled} onClick={() => onChange(sites.filter((x) => x.site !== s.site))}>
              ×
            </button>
          </span>
        </div>
      ))}
      <form
        className="ext-add"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input aria-label="Site to add" placeholder="e.g. mobile.de" value={name} disabled={disabled} onChange={(e) => setName(e.target.value)} />
        <select aria-label="How often it is sent" value={minutes} disabled={disabled} onChange={(e) => setMinutes(Number(e.target.value))}>
          {EXTERNAL_INTERVALS.map((c) => (
            <option key={c.minutes} value={c.minutes}>{c.label}</option>
          ))}
        </select>
        <button className="btn secondary" type="submit" disabled={disabled || !name.trim()}>Add</button>
      </form>
      {problem && <div className="sub ext-problem">{problem}</div>}
    </details>
  );
}
