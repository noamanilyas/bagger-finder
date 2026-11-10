"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { costPanel, landedAt, negotiatedText, offerRange, type PkrRate } from "@/lib/costs";
import { originalPrice } from "@/lib/currency";
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
  /** changes when the person changes what is shown (filters, search); the map then fits all pins again */
  fitKey?: string;
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

/** What the pin looks like: a pin is only redrawn when this changes, so a data refresh does not disturb an open popup. */
const iconKey = (l: Listing, selected: boolean) => `${selected ? "s" : isDealPin(l) ? "d" : "n"}${l.priceEur}`;

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

/** "What if I pay less?": slide the price down to 30% below asking and see what it lands at in Pakistan. */
function offerSlider(priceEur: number, rate: PkrRate | null): HTMLElement {
  const { min, max, step } = offerRange(priceEur);
  const box = element("div", "popup-offer");
  const head = element("div", "popup-offer-head");
  const label = element("label", "popup-kv", "If you pay") as HTMLLabelElement;
  const paid = element("strong", "popup-offer-price");
  head.append(label, paid);

  const input = document.createElement("input");
  input.type = "range";
  input.min = String(min);
  input.max = String(max);
  input.step = String(step);
  input.value = String(max);
  input.id = `offer-${Math.random().toString(36).slice(2)}`;
  label.htmlFor = input.id;
  const ends = element("div", "popup-offer-ends");
  ends.append(element("span", "", `${euro(min)} (−${Math.round(((max - min) / max) * 100)}%)`), element("span", "", `${euro(max)} asking`));

  const landed = element("div", "popup-offer-landed");
  const update = () => {
    const value = Number(input.value);
    const off = Math.round(((max - value) / max) * 100);
    paid.textContent = off > 0 ? `${euro(value)} · −${off}%` : `${euro(value)} · asking`;
    const at = landedAt(value, rate);
    landed.replaceChildren(element("span", "popup-kv", "Lands in Pakistan at"), element("strong", "", at.pkr ?? at.eur));
    if (at.pkr) landed.append(element("span", "cost-note", at.eur));
    if (off > 0 && rate) {
      const savedLakh = Number((((max - value) * rate.rate) / 100_000).toFixed(1));
      landed.append(element("span", "cost-note", `Rs ${savedLakh} lakh (${euro(max - value)}) less than at the asking price`));
    } else if (off > 0) {
      landed.append(element("span", "cost-note", `${euro(max - value)} less than at the asking price (${landedAt(max, rate).eur})`));
    }
  };
  input.addEventListener("input", update);
  // dragging the slider must not drag the map
  L.DomEvent.disableClickPropagation(box);
  update();

  box.append(head, input, ends, landed);
  return box;
}

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
  here.append(element("span", "popup-kv", "Price here"), element("strong", "", l.priceEur != null ? euro(l.priceEur) : (originalPrice(l) ?? "On request")));
  if (l.priceEur != null && originalPrice(l)) here.append(element("span", "cost-note", `listed as ${originalPrice(l)}`));
  if (l.priceEur != null && isSaleAd(l)) here.append(element("span", "cost-note", negotiatedText(l.priceEur)));
  if (l.priceNote) here.append(element("span", "cost-note", l.priceNote));
  const pk = element("div", "popup-box pk");
  pk.append(element("span", "popup-kv", "Landed in Pakistan"), element("strong", "", p.pkr ?? p.eur));
  if (p.pkr) pk.append(element("span", "cost-note", p.eur));
  const boxes = element("div", "popup-boxes");
  boxes.append(here, pk);

  const offer = l.priceEur != null && isSaleAd(l) ? offerSlider(l.priceEur, rate) : null;

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

  root.append(title, meta, boxes, ...(offer ? [offer] : []), more, actions);
  return root;
}

export default function Map({ listings, selectedId, onSelect, pkrRate, onMark, onPhoto, fitKey }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new globalThis.Map<string, { marker: L.Marker; listing: Listing; key: string }>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onMarkRef = useRef(onMark);
  onMarkRef.current = onMark;
  const onPhotoRef = useRef(onPhoto);
  onPhotoRef.current = onPhoto;
  // read when a popup opens, so a rate arriving later does not rebuild the markers and move the map
  const pkrRateRef = useRef(pkrRate);
  pkrRateRef.current = pkrRate;
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  // Fitting all pins is for the first load and for filter changes. A data refresh (every few seconds while a scrape runs)
  // must not undo the zoom the person chose or the machine they are looking at.
  const fitted = useRef<{ key: string | undefined } | null>(null);
  const userMoved = useRef(false);

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
    const moved = () => {
      userMoved.current = true;
    };
    const box = m.getContainer();
    for (const type of ["pointerdown", "wheel", "keydown"]) box.addEventListener(type, moved, { passive: true });
    return () => {
      for (const type of ["pointerdown", "wheel", "keydown"]) box.removeEventListener(type, moved);
      m.remove();
      map.current = null;
      layer.current = null;
      markers.current.clear(); // their layers went with the map
      fitted.current = null;
    };
  }, []);

  // Keep the pins in step with the visible listings: add new ones, drop gone ones, redraw only changed ones.
  // Recreating them all would close the open popup and lose the highlight on every data refresh.
  useEffect(() => {
    const m = map.current;
    const group = layer.current;
    if (!m || !group) return;
    const pts: L.LatLngTuple[] = [];
    const keep = new Set<string>();
    for (const l of listings) {
      if (l.lat == null || l.lng == null) continue;
      keep.add(l.id);
      const pos: L.LatLngTuple = [jitter(l.id, l.lat), jitter(l.id + "x", l.lng)];
      pts.push(pos);
      const key = iconKey(l, l.id === selectedRef.current);
      const have = markers.current.get(l.id);
      if (have) {
        have.listing = l; // the popup is built from this when it opens
        if (have.key !== key) {
          have.marker.setIcon(iconFor(l, l.id === selectedRef.current));
          have.key = key;
        }
        continue;
      }
      const entry = { marker: null as unknown as L.Marker, listing: l, key };
      entry.marker = L.marker(pos, { icon: iconFor(l, l.id === selectedRef.current) })
        .bindPopup(() => popupFor(entry.listing, pkrRateRef.current, onMarkRef.current && ((id) => onMarkRef.current?.(id)), (id) => onPhotoRef.current?.(id)), { minWidth: 320, maxWidth: 360 })
        .on("click", () => onSelectRef.current(l.id));
      entry.marker.addTo(group);
      markers.current.set(l.id, entry);
    }
    markers.current.forEach(({ marker }, id) => {
      if (keep.has(id)) return;
      group.removeLayer(marker);
      markers.current.delete(id);
    });

    if (!pts.length) return;
    const first = fitted.current === null;
    const filtersChanged = !first && fitted.current!.key !== fitKey;
    const leaveAlone = !!selectedRef.current || userMoved.current;
    if (first || filtersChanged || !leaveAlone) {
      m.fitBounds(L.latLngBounds(pts).pad(0.15), { maxZoom: 9 });
      userMoved.current = false;
    }
    fitted.current = { key: fitKey };
  }, [listings, fitKey]);

  // highlight + fly to the selected listing
  useEffect(() => {
    markers.current.forEach((entry, id) => {
      const key = iconKey(entry.listing, id === selectedId);
      if (key === entry.key) return;
      entry.marker.setIcon(iconFor(entry.listing, id === selectedId));
      entry.key = key;
    });
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
