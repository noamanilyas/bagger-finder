import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Listing } from "./types";

let client: SupabaseClient | null | undefined;

/** Server-side client (secret key). Returns null when Supabase is not configured. */
export function getSupabase(): SupabaseClient | null {
  if (client !== undefined) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  client = url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
  return client;
}

export const hasSupabase = () => getSupabase() !== null;

/* eslint-disable @typescript-eslint/no-explicit-any */
const toRow = (l: Listing) => ({
  id: l.id,
  url: l.url,
  source: l.source,
  title: l.title,
  description: l.description,
  make: l.make,
  model: l.model,
  model_key: l.modelKey,
  model_label: l.modelLabel,
  wheeled: l.wheeled,
  price_eur: l.priceEur,
  year: l.year,
  hours: l.hours,
  location: l.location,
  lat: l.lat,
  lng: l.lng,
  image_url: l.imageUrl,
  first_seen: l.firstSeen,
  last_seen: l.lastSeen,
});

const fromRow = (r: any): Listing => ({
  id: r.id,
  url: r.url,
  source: r.source,
  title: r.title,
  description: r.description ?? "",
  make: r.make,
  model: r.model,
  modelKey: r.model_key,
  modelLabel: r.model_label,
  wheeled: r.wheeled,
  priceEur: r.price_eur == null ? null : Number(r.price_eur),
  year: r.year,
  hours: r.hours,
  location: r.location,
  lat: r.lat,
  lng: r.lng,
  imageUrl: r.image_url,
  firstSeen: new Date(r.first_seen).toISOString(),
  lastSeen: new Date(r.last_seen).toISOString(),
});

/** All stored listings. Throws on database errors (e.g. table not created yet). */
export async function loadListings(): Promise<Listing[]> {
  const sb = getSupabase();
  if (!sb) return [];
  const out: Listing[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from("listings").select("*").order("id").range(from, from + 999);
    if (error) throw new Error(`Supabase read failed: ${error.message}`);
    out.push(...data.map(fromRow));
    if (data.length < 1000) break;
  }
  return out;
}

export async function saveListings(listings: Listing[]): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  for (let i = 0; i < listings.length; i += 200) {
    const { error } = await sb.from("listings").upsert(listings.slice(i, i + 200).map(toRow), { onConflict: "id" });
    if (error) throw new Error(`Supabase write failed: ${error.message}`);
  }
}

export async function deleteOlderThan(cutoffIso: string): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  const { error } = await sb.from("listings").delete().lt("last_seen", cutoffIso);
  if (error) throw new Error(`Supabase cleanup failed: ${error.message}`);
}
