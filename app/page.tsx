"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import AddComment, { isMarked, StarIcon } from "@/components/AddComment";
import ConfirmScrape from "@/components/ConfirmScrape";
import NextScrape from "@/components/NextScrape";
import PhotoViewer from "@/components/PhotoViewer";
import SignOut from "@/components/SignOut";
import { DEFAULT_LIMITS, withinLimits } from "@/lib/config";
import { costPanel, NEGOTIATION, negotiatedText, type PkrRate } from "@/lib/costs";
import { isSaleAd } from "@/lib/market";
import { INTERVAL_CHOICES, type Schedule } from "@/lib/schedule";
import type { ScraperSettings } from "@/lib/settings";
import { shortId, type Listing, type Status } from "@/lib/types";

const Map = dynamic(() => import("@/components/Map"), {
  ssr: false,
  loading: () => <div className="map map-loading">Loading map…</div>,
});

type Payload = {
  updatedAt: string | null;
  listings: Listing[];
  models: { key: string; label: string }[];
  status: Status;
  schedule: Schedule | null;
};

const SORTS = {
  interesting: "Most interesting",
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

/** Interesting first, then not reviewed yet, then cheap but doubtful, then everything else. */
function dealRank(l: Listing): number {
  if (!isDeal(l)) return 3;
  if (l.aiVerdict === "interesting") return 0;
  return l.aiVerdict === "suspicious" ? 2 : 1;
}

function sorter(key: SortKey): (a: Listing, b: Listing) => number {
  switch (key) {
    case "interesting":
      return (a, b) => dealRank(a) - dealRank(b) || num(a.belowPct, b.belowPct, -1) || b.firstSeen.localeCompare(a.firstSeen);
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

/** So "b55w" finds "B 55W-2" and "robex 55" finds "ROBEX55W-9A". */
const squash = (s: string) => s.toLowerCase().replace(/[\s-]/g, "");

/** A filter box holds digits; empty means no limit. */
const limitOf = (s: string) => parseInt(s, 10) || null;

const DEAL_LABEL = {
  interesting: "Interesting",
  suspicious: "Cheap, but check carefully",
  not_comparable: "",
  unchecked: "Below market, not reviewed",
};

/** Well below similar machines or marked interesting by the buyer, unless AI found the price is not comparable. */
function isDeal(l: Listing): boolean {
  return (l.flagged || !!l.knowledge?.some((k) => k.interesting)) && l.aiVerdict !== "not_comparable";
}

const dealLabel = (l: Listing) =>
  !l.aiVerdict && !l.flagged ? "Marked interesting, not reviewed" : DEAL_LABEL[l.aiVerdict ?? "unchecked"];

const dealWhy = (l: Listing) =>
  [
    l.flagged && `Asking ${l.belowPct}% below the median asking price of ${l.marketCount} similar machines in your range (${eur(l.marketMedian!)})`,
    l.aiReason && `AI: ${l.aiReason}`,
  ]
    .filter((part): part is string => !!part)
    .map((part) => part.replace(/\.$/, ""))
    .join(". ");

function PakistanCost({ listing, rate }: { listing: Listing; rate: PkrRate | null }) {
  const p = costPanel(listing.priceEur, rate, isSaleAd(listing));
  return (
    // opening the details must not also select the card, which would move the map
    <details className="cost" onClick={(e) => e.stopPropagation()}>
      <summary>
        <span className="cost-head">Pakistan cost</span>
        <span className="cost-totals">
          {p.pkr && <strong>{p.pkr}</strong>}
          <strong>{p.eur}</strong>
        </span>
        {p.negotiated && <span className="cost-note">{p.negotiated}</span>}
      </summary>
      <div className="cost-note">{p.breakdown}</div>
      <div className="cost-note">{p.rateNote}</div>
    </details>
  );
}

type IconProps = { size?: number };
const svg = (size: number, children: React.ReactNode, sw = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {children}
  </svg>
);
const IconSearch = ({ size = 16 }: IconProps) => svg(size, <><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></>);
const IconSliders = ({ size = 16 }: IconProps) =>
  svg(size, <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>);
const IconX = ({ size = 16 }: IconProps) => svg(size, <path d="M6 6l12 12M18 6L6 18" />, 2.2);
const IconRefresh = ({ size = 16 }: IconProps) => svg(size, <><path d="M21 12a9 9 0 1 1-2.6-6.4" /><path d="M21 3v6h-6" /></>);
const IconGear = ({ size = 18 }: IconProps) =>
  svg(size, <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>, 1.8);
const IconBagger = ({ size = 22 }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="6" y="24" width="20" height="10" rx="2" /><path d="M12 24v-7h9l3 7" /><path d="M26 27l8-12 8 4-2 9" /><circle cx="11" cy="38" r="3" /><circle cx="21" cy="38" r="3" />
  </svg>
);

const VIEWS = [
  ["list", "List"],
  ["split", "List + map"],
  ["map", "Map"],
] as const;
type View = (typeof VIEWS)[number][0];

export default function Home() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("interesting");
  const [models, setModels] = useState<Set<string>>(new Set());
  const [source, setSource] = useState("all");
  const [maxPrice, setMaxPrice] = useState(String(DEFAULT_LIMITS.maxPrice ?? ""));
  const [maxYear, setMaxYear] = useState(String(DEFAULT_LIMITS.maxYear ?? ""));
  const [modelText, setModelText] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [wheeledOnly, setWheeledOnly] = useState(true);
  const [dealsOnly, setDealsOnly] = useState(false);
  const [settings, setSettings] = useState<ScraperSettings | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pkrRate, setPkrRate] = useState<PkrRate | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [view, setView] = useState<View>("split");
  /** the listing whose comment / mark-interesting dialog is open */
  const [commentFor, setCommentFor] = useState<string | null>(null);
  const closeComment = useCallback(() => setCommentFor(null), []);
  const [confirmingScrape, setConfirmingScrape] = useState(false);
  const [photoFor, setPhotoFor] = useState<string | null>(null);
  const closePhoto = useCallback(() => setPhotoFor(null), []);
  const closeConfirmScrape = useCallback(() => setConfirmingScrape(false), []);
  // phones start on the list: list and map side by side do not fit
  useEffect(() => {
    if (window.matchMedia("(max-width: 800px)").matches) setView("list");
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/listings", { cache: "no-store" });
      // the session ended while the page was open; reloading goes to the sign-in page
      if (res.status === 401) {
        window.location.reload();
        return;
      }
      setData((await res.json()) as Payload);
      setError(null);
    } catch {
      setError("Could not load listings.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    fetch("/api/settings", { cache: "no-store" })
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setSettings((await res.json()) as ScraperSettings);
      })
      .catch(() => setError("Could not load scraper settings."));
  }, []);

  useEffect(() => {
    fetch("/api/rate", { cache: "no-store" })
      .then(async (res) => {
        if (res.ok) setPkrRate((await res.json()) as PkrRate);
      })
      .catch(() => {}); // the cost panels say when there is no rate
  }, []);

  const saveSetting = async (change: Partial<ScraperSettings>) => {
    if (!settings) return;
    const before = settings;
    setSettings({ ...settings, ...change }); // a control must respond at once; undone below if saving fails
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(change),
    }).catch(() => null);
    if (!res?.ok) {
      setSettings(before);
      setError("Could not save scraper settings.");
      return;
    }
    if (change.intervalMinutes !== undefined) await load(); // the next scrape time follows the interval
  };

  const running = data?.status.running ?? false;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => void load(), 5000);
    return () => clearInterval(t);
  }, [running, load]);

  // an automatic scrape may start while the question is open
  useEffect(() => {
    if (running) setConfirmingScrape(false);
  }, [running]);

  const refresh = async () => {
    const res = await fetch("/api/scrape", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ maxPrice: limitOf(maxPrice), maxYear: limitOf(maxYear) }),
    });
    const result = (await res.json().catch(() => null)) as { started?: boolean; reason?: string } | null;
    await load();
    if (result && !result.started) setError(`Not started: ${result.reason ?? "try again shortly."}`);
  };

  const sources = useMemo(() => [...new Set((data?.listings ?? []).map((l) => l.source))].sort(), [data]);

  const visible = useMemo(() => {
    const limits = { maxPrice: limitOf(maxPrice), maxYear: limitOf(maxYear) };
    const modelQ = squash(modelText);
    const q = query.trim().toLowerCase().replace(/^#/, "");
    return (data?.listings ?? [])
      .filter((l) => models.size === 0 || models.has(l.modelKey))
      .filter((l) => !wheeledOnly || l.wheeled)
      .filter((l) => !dealsOnly || isDeal(l))
      .filter((l) => source === "all" || l.source === source)
      .filter((l) => withinLimits(l, limits))
      .filter((l) => !modelQ || squash(`${l.title} ${l.make ?? ""} ${l.model ?? ""}`).includes(modelQ))
      .filter((l) => !q || `${l.id} ${l.title} ${l.description} ${l.location ?? ""}`.toLowerCase().includes(q))
      .sort(sorter(sort));
  }, [data, models, source, maxPrice, maxYear, modelText, query, sort, wheeledOnly, dealsOnly]);

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

  /** Filters that are on, shown as removable chips while the filter panel is closed. */
  const activeFilters: { label: string; clear: () => void }[] = [
    ...(wheeledOnly ? [{ label: "Mobilbagger", clear: () => setWheeledOnly(false) }] : []),
    ...(dealsOnly ? [{ label: "Below market", clear: () => setDealsOnly(false) }] : []),
    ...(data?.models ?? []).filter((m) => models.has(m.key)).map((m) => ({ label: m.label, clear: () => toggleModel(m.key) })),
    ...(modelText.trim() ? [{ label: `Model: ${modelText.trim()}`, clear: () => setModelText("") }] : []),
    ...(limitOf(maxPrice) != null ? [{ label: `Max ${eur(limitOf(maxPrice)!)}`, clear: () => setMaxPrice("") }] : []),
    ...(limitOf(maxYear) != null ? [{ label: `Up to ${maxYear}`, clear: () => setMaxYear("") }] : []),
    ...(source !== "all" ? [{ label: source, clear: () => setSource("all") }] : []),
  ];

  /** Back to the filters the page starts with (Max € and Max year also feed "Refresh now"). */
  const resetFilters = () => {
    setWheeledOnly(true);
    setDealsOnly(false);
    setModels(new Set());
    setModelText("");
    setMaxPrice(String(DEFAULT_LIMITS.maxPrice ?? ""));
    setMaxYear(String(DEFAULT_LIMITS.maxYear ?? ""));
    setSource("all");
  };

  const photoListing = photoFor ? data?.listings.find((x) => x.id === photoFor) : undefined;
  const commentListing = commentFor ? (data?.listings.find((x) => x.id === commentFor) ?? null) : null;
  const failed = Object.entries(data?.status.sources ?? {}).filter(([, s]) => !s.ok);
  const pagesDone = data?.status.pagesDone ?? 0;
  const pagesTotal = data?.status.pagesTotal ?? 0;
  const lastActivity = data?.status.lastActivity;
  const quietSeconds = lastActivity ? Math.max(0, Math.round((Date.now() - Date.parse(lastActivity)) / 1000)) : 0;

  return (
    <div className="app">
      <header className="top">
        <div className="brand">
          <span className="logo" aria-hidden="true"><IconBagger /></span>
          <h1>Bagger Finder</h1>
          <span className="sub">
            {data ? `${visible.length} of ${data.listings.length}` : "Loading…"}
            {data?.updatedAt && ` · updated ${new Date(data.updatedAt).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}`}
          </span>
        </div>
        <div className="seg" role="group" aria-label="View">
          {VIEWS.map(([k, label]) => (
            <button key={k} className={view === k ? "on" : ""} aria-pressed={view === k} onClick={() => setView(k)}>
              {label}
            </button>
          ))}
        </div>
        <div className="top-actions">
          {data?.schedule && !running && <NextScrape schedule={data.schedule} onDue={load} />}
          <button
            onClick={() => setSettingsOpen((v) => !v)}
            className={`btn secondary icon${settingsOpen ? " on" : ""}`}
            aria-expanded={settingsOpen}
            aria-label="Scraper settings"
            title="Scraper settings"
          >
            <IconGear />
          </button>
          <button onClick={() => setConfirmingScrape(true)} disabled={running} className="btn refresh" aria-label={running ? "Scraping" : "Refresh now"} title="Scrapes using the Max € and Max year set in the filters">
            <IconRefresh />
            {running ? "Scraping…" : "Refresh now"}
          </button>
          <SignOut />

          {settingsOpen && (
            <div className="popover settings" role="dialog" aria-label="Scraper settings">
              <div className="popover-head">
                <strong>Scraper settings</strong>
                <button className="btn ghost icon" aria-label="Close" onClick={() => setSettingsOpen(false)}>
                  <IconX />
                </button>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={settings?.mobileOnly ?? false}
                  disabled={!settings}
                  onChange={(e) => void saveSetting({ mobileOnly: e.target.checked })}
                />
                <span>
                  <span className="check-title">Only scrape Mobilbagger</span>
                  <span className="sub">Listed crawlers, graders, loaders and rollers are always searched. Used from the next scrape, including the automatic ones. Machines already stored stay until they expire.</span>
                </span>
              </label>
              <label className="field-label">
                Scrape automatically every
                <select
                  value={settings?.intervalMinutes ?? ""}
                  disabled={!settings}
                  onChange={(e) => void saveSetting({ intervalMinutes: Number(e.target.value) })}
                >
                  {INTERVAL_CHOICES.map((c) => (
                    <option key={c.minutes} value={c.minutes}>{c.label}</option>
                  ))}
                </select>
              </label>
              <div className="sub">
                {data && !data.schedule
                  ? "Automatic scraping is switched off on this server (AUTO_SCRAPE=false)."
                  : "The next scrape is due this long after the last one started, whether it was automatic or “Refresh now”. A restart does not reset it; a missed one runs at startup."}
              </div>
            </div>
          )}
        </div>
      </header>

      {data && running && (
        <div className="notice" role="status">
          <div>{data.status.message}</div>
          {pagesTotal > 0 && <progress value={pagesDone} max={pagesTotal} style={{ width: "100%" }} aria-label="Pages read" />}
          <div className="sub">
            {pagesTotal > 0 && `${pagesDone} of ${pagesTotal} pages done · `}
            {quietSeconds >= 120
              ? `no progress for ${Math.round(quietSeconds / 60)} min, it may be stuck (a new scrape is allowed after 10 min)`
              : `last update ${quietSeconds}s ago`}
            {" · safe to close this tab; the list updates when it finishes"}
          </div>
        </div>
      )}
      {data && !running && failed.length > 0 && (
        <div className="notice">
          {`${failed.length} source(s) failed: ${failed.map(([id, s]) => `${id} (${s.error ?? "error"})`).join("; ")}`}
        </div>
      )}
      {error && <div className="notice err">{error}</div>}

      <div className={`split view-${view}`}>
        {view !== "map" && (
          <aside className="left">
            <div className="controls">
              <div className="row">
                <label className="search">
                  <IconSearch />
                  <input placeholder="Search text, town or ID" aria-label="Search text, town or ID" value={query} onChange={(e) => setQuery(e.target.value)} />
                </label>
                <button
                  className={`btn secondary filters-btn${filtersOpen || activeFilters.length ? " on" : ""}`}
                  aria-expanded={filtersOpen}
                  onClick={() => setFiltersOpen((v) => !v)}
                >
                  <IconSliders />
                  Filters
                  {activeFilters.length > 0 && <span className="badge">{activeFilters.length}</span>}
                </button>
              </div>

              {filtersOpen ? (
                <div className="filter-panel">
                  <div className="filter-grid">
                    <label className="field-label">
                      Model
                      <input placeholder="e.g. B55W" value={modelText} onChange={(e) => setModelText(e.target.value)} />
                    </label>
                    <label className="field-label" title={`Your budget. Also shows machines asking more, if ${NEGOTIATION.maxPct}% off would bring them within it.`}>
                      Max €
                      <input inputMode="numeric" placeholder="Any" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))} />
                    </label>
                    <label className="field-label">
                      Max year
                      <input inputMode="numeric" placeholder="Any" value={maxYear} onChange={(e) => setMaxYear(e.target.value.replace(/\D/g, ""))} />
                    </label>
                  </div>
                  <label className="field-label">
                    Source
                    <select value={source} onChange={(e) => setSource(e.target.value)}>
                      <option value="all">All sources</option>
                      {sources.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <span className="group-label">Show</span>
                    <div className="chips">
                      <button className={`chip wheel${wheeledOnly ? " on" : ""}`} aria-pressed={wheeledOnly} onClick={() => setWheeledOnly((v) => !v)}>
                        Mobilbagger only
                      </button>
                      <button className={`chip deal${dealsOnly ? " on" : ""}`} aria-pressed={dealsOnly} onClick={() => setDealsOnly((v) => !v)}>
                        Below market only
                      </button>
                    </div>
                  </div>
                  <div>
                    <span className="group-label">Models</span>
                    <div className="chips">
                      {(data?.models ?? []).filter((m) => models.has(m.key) || data?.listings.some((l) => l.modelKey === m.key)).map((m) => (
                        <button key={m.key} className={`chip${models.has(m.key) ? " on" : ""}`} aria-pressed={models.has(m.key)} onClick={() => toggleModel(m.key)}>
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="filter-foot">
                    <button className="btn ghost" onClick={resetFilters}>Reset</button>
                    <button className="btn" onClick={() => setFiltersOpen(false)}>Show {visible.length} machines</button>
                  </div>
                </div>
              ) : (
                activeFilters.length > 0 && (
                  <div className="active-chips">
                    {activeFilters.map((f) => (
                      <button key={f.label} className="chip active" onClick={f.clear} aria-label={`Remove filter ${f.label}`}>
                        {f.label}
                        <IconX size={12} />
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>

            <div className="list-head">
              <span><strong>{visible.length}</strong> machines</span>
              <label>
                Sort
                <select value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
                  {Object.entries(SORTS).map(([k, label]) => (
                    <option key={k} value={k}>{label}</option>
                  ))}
                </select>
              </label>
            </div>

            <ul className="list">
              {visible.map((l) => (
                <li key={l.id} id={`item-${l.id}`} className={`card${l.id === selected ? " sel" : ""}`} onClick={() => select(l.id)}>
                  {l.imageUrl ? (
                    // opening the photo must not also select the card, which would move the map
                    <button
                      className="photo-btn"
                      aria-label={`View photo of ${l.title}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPhotoFor(l.id);
                      }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={l.imageUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
                    </button>
                  ) : (
                    <span className="thumb" aria-hidden="true"><IconBagger size={30} /></span>
                  )}
                  <div className="body">
                    <div className="title-row">
                      <a href={l.url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="title" title={l.title}>
                        {l.title}
                      </a>
                      <strong className="price" title={l.priceEur != null && isSaleAd(l) ? negotiatedText(l.priceEur) : undefined}>
                        {l.priceEur != null ? eur(l.priceEur) : "On request"}
                      </strong>
                    </div>
                    <div className="facts">
                      {[l.year, l.hours != null ? `${l.hours.toLocaleString("de-DE")} h` : null, l.location].filter(Boolean).join(" · ")}
                    </div>
                    {isDeal(l) && dealWhy(l) && (
                      <p className="deal-why" title={dealWhy(l)}>{dealWhy(l)}</p>
                    )}
                    <div className="tags">
                      <span className="tag model">{l.modelLabel}</span>
                      {!wheeledOnly && l.wheeled && <span className="tag wheel">Mobilbagger</span>}
                      {isDeal(l) && <span className={`tag deal ${l.aiVerdict ?? "unchecked"}`}>{dealLabel(l)}</span>}
                      {l.lat == null && <span className="tag warn">no map location</span>}
                      <span className="tag source">{l.source}</span>
                      <span className="tag listing-id" title={`Listing ID ${l.id}`}>#{shortId(l.id)}</span>
                      {l.priceEur != null && (
                        <span className="to-pk">
                          To PK <strong>{costPanel(l.priceEur, pkrRate, isSaleAd(l)).pkr ?? costPanel(l.priceEur, pkrRate, isSaleAd(l)).eur}</strong>
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    className={`star${isMarked(l) ? " on" : ""}`}
                    aria-label={isMarked(l) ? "Edit interesting note" : "Mark interesting"}
                    title={isMarked(l) ? "Edit interesting note" : "Mark interesting"}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCommentFor(l.id);
                    }}
                  >
                    <StarIcon filled={isMarked(l)} size={20} />
                  </button>
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
        )}

        {view !== "list" && (
          <main className="right">
            <Map listings={visible} selectedId={selected} onSelect={select} pkrRate={pkrRate} onMark={setCommentFor} onPhoto={setPhotoFor} />
          </main>
        )}
      </div>

      {commentListing && (
        <AddComment
          key={commentListing.id}
          listing={commentListing}
          all={data?.listings ?? []}
          onChange={load}
          onClose={closeComment}
          summary={isDeal(commentListing) ? dealWhy(commentListing) : null}
        />
      )}

      {photoListing?.imageUrl && (
        <PhotoViewer listing={{ ...photoListing, imageUrl: photoListing.imageUrl }} onClose={closePhoto} />
      )}

      {confirmingScrape && (
        <ConfirmScrape
          details={[
            `Max price: ${limitOf(maxPrice) != null ? eur(limitOf(maxPrice)!) : "no limit"}`,
            `Max year: ${limitOf(maxYear) ?? "no limit"}`,
            ...(settings ? [settings.mobileOnly ? "Mobilbagger, plus listed non-wheeled machines" : "All machine types"] : []),
          ]}
          onConfirm={() => {
            setConfirmingScrape(false);
            void refresh();
          }}
          onClose={closeConfirmScrape}
        />
      )}
    </div>
  );
}
