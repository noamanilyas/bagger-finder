"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { costPanel, negotiatedText, type PkrRate } from "@/lib/costs";
import { isSaleAd } from "@/lib/market";
import { shortId, type Listing } from "@/lib/types";

type Props = {
  listings: Listing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  pkrRate: PkrRate | null;
  /** opens the comment / mark-interesting dialog for a listing */
  onMark?: (id: string) => void;
  /** opens the machine's photo in the big view */
  onPhoto?: (id: string) => void;
};

const fmtPrice = (p: number | null) => (p == null ? "?" : p >= 1000 ? `${Math.round(p / 1000)}k` : String(p));

/** Listings only carry town-level coordinates; nudge identical ones apart so pins don't hide each other. */
function jitter(id: string, base: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return base + ((h % 1000) / 1000) * 0.012;
}

/** Same rule as the list's deal tag: below market or matching the buyer's notes, unless AI found it not comparable. */
const isDealPin = (l: Listing) => (l.flagged || !!l.knowledge?.length) && l.aiVerdict !== "not_comparable";

function iconFor(l: Listing, selected: boolean) {
  return L.divIcon({
    className: "pin-wrap",
    html: `<div class="pin${selected ? " sel" : isDealPin(l) ? " deal" : ""}">€${fmtPrice(l.priceEur)}</div>`,
    iconSize: [0, 0],
  });
}

function element(tag: string, className: string, text = ""): HTMLElement {
  const el = document.createElement(tag);
  el.className = className;
  el.textContent = text;
  return el;
}

const STAR = (filled: boolean) =>
  `<svg width="16" height="16" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/></svg>`;

const euro = (n: number) => `€${n.toLocaleString("de-DE")}`;

function popupFor(l: Listing, rate: PkrRate | null, onMark?: (id: string) => void, onPhoto?: (id: string) => void): HTMLElement {
  const p = costPanel(l.priceEur, rate, isSaleAd(l));
  const root = element("div", "popup");

  if (l.imageUrl) {
    const photo = document.createElement("button");
    photo.type = "button";
    photo.className = "popup-photo";
    photo.setAttribute("aria-label", `View photo of ${l.title}`);
    const img = document.createElement("img");
    img.alt = "";
    img.referrerPolicy = "no-referrer";
    img.src = l.imageUrl;
    // a photo the site no longer serves should leave no empty box
    img.addEventListener("error", () => photo.remove());
    photo.append(img);
    photo.addEventListener("click", () => onPhoto?.(l.id));
    root.append(photo);
  }

  const title = document.createElement("a");
  title.className = "popup-title";
  title.href = l.url;
  title.target = "_blank";
  title.rel = "noopener noreferrer";
  title.textContent = l.title;
  const meta = element(
    "div",
    "popup-meta",
    [`#${shortId(l.id)}`, l.modelLabel, l.year, l.hours != null ? `${l.hours.toLocaleString("de-DE")} h` : null, l.location].filter(Boolean).join(" · "),
  );

  const here = element("div", "popup-box");
  here.append(element("span", "popup-kv", "Price here"), element("strong", "", l.priceEur != null ? euro(l.priceEur) : "On request"));
  if (l.priceEur != null && isSaleAd(l)) here.append(element("span", "cost-note", negotiatedText(l.priceEur)));
  const pk = element("div", "popup-box pk");
  pk.append(element("span", "popup-kv", "Landed in Pakistan"), element("strong", "", p.pkr ?? p.eur));
  if (p.pkr) pk.append(element("span", "cost-note", p.eur));
  const boxes = element("div", "popup-boxes");
  boxes.append(here, pk);

  const more = element("details", "popup-more");
  more.append(element("summary", "", "Cost breakdown"));
  if (p.negotiated) more.append(element("div", "cost-note", p.negotiated));
  more.append(element("div", "cost-note", p.breakdown), element("div", "cost-note", p.rateNote));

  const actions = element("div", "popup-actions");
  const open = document.createElement("a");
  open.className = "btn";
  open.href = l.url;
  open.target = "_blank";
  open.rel = "noopener noreferrer";
  open.textContent = "Open listing";
  actions.append(open);
  if (onMark) {
    const marked = !!l.knowledge?.some((k) => k.interesting);
    const mark = document.createElement("button");
    mark.type = "button";
    mark.className = `btn secondary mark-btn${marked ? " on" : ""}`;
    mark.innerHTML = STAR(marked);
    mark.append(document.createTextNode(marked ? "Edit interesting note" : "Mark interesting"));
    mark.addEventListener("click", () => onMark(l.id));
    actions.append(mark);
  }

  root.append(title, meta, boxes, more, actions);
  return root;
}

export default function Map({ listings, selectedId, onSelect, pkrRate, onMark, onPhoto }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new globalThis.Map<string, { marker: L.Marker; listing: Listing }>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onMarkRef = useRef(onMark);
  onMarkRef.current = onMark;
  const onPhotoRef = useRef(onPhoto);
  onPhotoRef.current = onPhoto;
  // read when a popup opens, so a rate arriving later does not rebuild the markers and move the map
  const pkrRateRef = useRef(pkrRate);
  pkrRateRef.current = pkrRate;

  // create the map once
  useEffect(() => {
    if (!el.current || map.current) return;
    const m = L.map(el.current, { zoomControl: true }).setView([51.1, 10.4], 6);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 18,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(m);
    layer.current = L.layerGroup().addTo(m);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []);

  // (re)build markers when the visible listings change
  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    group.clearLayers();
    markers.current.clear();
    const pts: L.LatLngTuple[] = [];
    for (const l of listings) {
      if (l.lat == null || l.lng == null) continue;
      const pos: L.LatLngTuple = [jitter(l.id, l.lat), jitter(l.id + "x", l.lng)];
      const marker = L.marker(pos, { icon: iconFor(l, false) })
        .bindPopup(() => popupFor(l, pkrRateRef.current, onMarkRef.current && ((id) => onMarkRef.current?.(id)), (id) => onPhotoRef.current?.(id)), { minWidth: 320, maxWidth: 360 })
        .on("click", () => onSelectRef.current(l.id));
      marker.addTo(group);
      markers.current.set(l.id, { marker, listing: l });
      pts.push(pos);
    }
    if (pts.length) m.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 9 });
  }, [listings]);

  // highlight + fly to the selected listing
  useEffect(() => {
    markers.current.forEach(({ marker, listing }, id) => marker.setIcon(iconFor(listing, id === selectedId)));
    const hit = selectedId ? markers.current.get(selectedId) : null;
    if (hit && map.current) {
      const m = map.current;
      // The flight cancels the pan that fits an opening popup on the map, so fit it once the flight ends.
      // The flight centers the pin, so only the top of the popup can stick out.
      const fitPopup = () => {
        const popup = hit.marker.getPopup()?.getElement();
        if (!popup) return;
        const overlap = popup.getBoundingClientRect().top - m.getContainer().getBoundingClientRect().top - 10;
        if (overlap < 0) m.panBy([0, overlap]);
      };
      // Open first: opening during the flight would end it early. Listen last: starting the flight ends any earlier move.
      hit.marker.openPopup();
      m.flyTo(hit.marker.getLatLng(), Math.max(m.getZoom(), 9), { duration: 0.6 });
      m.once("moveend", fitPopup);
      return () => {
        m.off("moveend", fitPopup);
      };
    }
  }, [selectedId]);

  return <div ref={el} className="map" />;
}
