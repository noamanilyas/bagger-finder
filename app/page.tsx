"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { Listing, Status } from "@/lib/types";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="map map-loading">Loading map…</div>,
});

type Payload = {
  updatedAt: string | null;
  listings: Listing[];
  models: { key: string; label: string }[];
  status: Status;
};

const SORTS = {
  newest: "Newest first",
  priceAsc: "Price: low → high",
  priceDesc: "Price: high → low",
  yearDesc: "Year: newest",
  yearAsc: "Year: oldest",
  hoursAsc: "Hours: lowest",
  model: "Model A–Z",
} as const;
type SortKey = keyof typeof SORTS;

/** nulls always sort last */
const num = (a: number | null, b: number | null, dir: 1 | -1) =>
  a == null ? (b == null ? 0 : 1) : b == null ? -1 : (a - b) * dir;

function sorter(key: SortKey): (a: Listing, b: Listing) => number {
  switch (key) {
    case "priceAsc": return (a, b) => num(a.priceEur, b.priceEur, 1);
    case "priceDesc": return (a, b) => num(a.priceEur, b.priceEur, -1);
    case "yearDesc": return (a, b) => num(a.year, b.year, -1);
    case "yearAsc": return (a, b) => num(a.year, b.year, 1);
    case "hoursAsc": return (a, b) => num(a.hours, b.hours, 1);
    case "model": return (a, b) => a.modelLabel.localeCompare(b.modelLabel) || num(a.priceEur, b.priceEur, 1);
    default: return (a, b) => b.firstSeen.localeCompare(a.firstSeen);
  }
}

const eur = (n: number) => `€${n.toLocaleString("de-DE")}`;

export default function Home() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [models, setModels] = useState<Set<string>>(new Set());
  const [source, setSource] = useState("all");
  const [maxPrice, setMaxPrice] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [wheeledOnly, setWheeledOnly] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/listings", { cache: "no-store" });
      setData((await res.json()) as Payload);
      setError(null);
    } catch {
      setError("Could not load listings.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const running = data?.status.running ?? false;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [running, load]);

  const refresh = async () => {
    await fetch("/api/scrape", { method: "POST" });
    void load();
  };

  const sources = useMemo(() => [...new Set((data?.listings ?? []).map((l) => l.source))].sort(), [data]);

  const visible = useMemo(() => {
    const max = parseInt(maxPrice, 10);
    const q = query.trim().toLowerCase();
    return (data?.listings ?? [])
      .filter((l) => models.size === 0 || models.has(l.modelKey))
      .filter((l) => !wheeledOnly || l.wheeled)
      .filter((l) => source === "all" || l.source === source)
      .filter((l) => isNaN(max) || (l.priceEur != null && l.priceEur <= max))
      .filter((l) => !q || `${l.title} ${l.description} ${l.location ?? ""}`.toLowerCase().includes(q))
      .sort(sorter(sort));
  }, [data, models, source, maxPrice, query, sort, wheeledOnly]);

  const select = useCallback((id: string) => {
    setSelected(id);
    document.getElementById(`item-${id}`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, []);

  const toggleModel = (k: string) =>
    setModels((cur) => {
      const next = new Set(cur);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const failed = Object.entries(data?.status.sources ?? {}).filter(([, s]) => !s.ok);

  return (
    <div className="app">
      <header className="top">
        <div>
          <h1>Bagger Finder</h1>
          <div className="sub">
            {data ? `${visible.length} of ${data.listings.length} listings` : "Loading…"}
            {data?.updatedAt && ` · updated ${new Date(data.updatedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}`}
          </div>
        </div>
        <button onClick={() => void refresh()} disabled={running} className="btn">
          {running ? "Scraping…" : "Refresh now"}
        </button>
      </header>

      {data && (running || failed.length > 0) && (
        <div className="notice">
          {running ? data.status.message : `${failed.length} source(s) failed: ${failed.map(([id, s]) => `${id} (${s.error ?? "error"})`).join("; ")}`}
        </div>
      )}
      {error && <div className="notice err">{error}</div>}

      <div className="split">
        <aside className="left">
          <div className="controls">
            <div className="chips">
              <button className={`chip wheel${wheeledOnly ? " on" : ""}`} onClick={() => setWheeledOnly((v) => !v)}>
                Mobilbagger only
              </button>
              {(data?.models ?? []).map((m) => (
                <button key={m.key} className={`chip${models.has(m.key) ? " on" : ""}`} onClick={() => toggleModel(m.key)}>
                  {m.label}
                </button>
              ))}
            </div>
            <div className="row">
              <input placeholder="Search text or town" value={query} onChange={(e) => setQuery(e.target.value)} />
              <input
                className="narrow"
                inputMode="numeric"
                placeholder="Max €"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <div className="row">
              <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)} aria-label="Sort">
                {Object.entries(SORTS).map(([k, label]) => (
                  <option key={k} value={k}>{label}</option>
                ))}
              </select>
              <select value={source} onChange={(e) => setSource(e.target.value)} aria-label="Source">
                <option value="all">All sources</option>
                {sources.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
          </div>

          <ul className="list">
            {visible.map((l) => (
              <li key={l.id} id={`item-${l.id}`} className={`card${l.id === selected ? " sel" : ""}`} onClick={() => select(l.id)}>
                {l.imageUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={l.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                )}
                <div className="body">
                  <a href={l.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="title">
                    {l.title}
                  </a>
                  <div className="tags">
                    <span className="tag model">{l.modelLabel}</span>
                    {l.wheeled && <span className="tag wheel">Mobilbagger</span>}
                    <span className="tag">{l.source}</span>
                    {l.lat == null && <span className="tag warn">no map location</span>}
                  </div>
                  <div className="facts">
                    <strong>{l.priceEur != null ? eur(l.priceEur) : "Price on request"}</strong>
                    {l.year && <span>{l.year}</span>}
                    {l.hours != null && <span>{l.hours.toLocaleString("de-DE")} h</span>}
                    {l.location && <span>{l.location}</span>}
                  </div>
                  {l.description && <p>{l.description}</p>}
                </div>
              </li>
            ))}
            {data && visible.length === 0 && (
              <li className="empty">
                {data.listings.length === 0
                  ? running
                    ? "First scrape in progress — listings will appear here in a few minutes."
                    : "No listings yet. Press “Refresh now” to run the first scrape."
                  : "No listings match these filters."}
              </li>
            )}
          </ul>
        </aside>

        <main className="right">
          <Map listings={visible} selectedId={selected} onSelect={select} />
        </main>
      </div>
    </div>
  );
}
