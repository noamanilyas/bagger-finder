"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { Listing } from "@/lib/types";

type Props = {
  listings: Listing[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

const fmtPrice = (p: number | null) => (p == null ? "?" : p >= 1000 ? `${Math.round(p / 1000)}k` : String(p));

/** Listings only carry town-level coordinates; nudge identical ones apart so pins don't hide each other. */
function jitter(id: string, base: number): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return base + ((h % 1000) / 1000) * 0.012;
}

function iconFor(l: Listing, selected: boolean) {
  return L.divIcon({
    className: "pin-wrap",
    html: `<div class="pin${selected ? " sel" : ""}">€${fmtPrice(l.priceEur)}</div>`,
    iconSize: [0, 0],
  });
}

function popupFor(l: Listing): HTMLElement {
  const root = document.createElement("div");
  root.className = "popup";
  const a = document.createElement("a");
  a.href = l.url;
  a.target = "_blank";
  a.rel = "noopener noreferrer";
  a.textContent = l.title;
  const meta = document.createElement("div");
  meta.textContent = [l.modelLabel, l.priceEur != null ? `€${l.priceEur.toLocaleString("de-DE")}` : null, l.year, l.location]
    .filter(Boolean)
    .join(" · ");
  root.append(a, meta);
  return root;
}

export default function Map({ listings, selectedId, onSelect }: Props) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const markers = useRef(new globalThis.Map<string, { marker: L.Marker; listing: Listing }>());
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

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
        .bindPopup(() => popupFor(l))
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
      map.current.flyTo(hit.marker.getLatLng(), Math.max(map.current.getZoom(), 9), { duration: 0.6 });
      hit.marker.openPopup();
    }
  }, [selectedId]);

  return <div ref={el} className="map" />;
}
