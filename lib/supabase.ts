import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { planHistory, type HistoryHead } from "./history";
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
  card_hash: l.cardHash,
  card_text: l.cardText,
  ad_type: l.adType,
  issues: l.issues,
  price_note: l.priceNote,
  market_median: l.marketMedian,
  market_count: l.marketCount,
  below_pct: l.belowPct,
  flagged: l.flagged,
  ai_verdict: l.aiVerdict,
  ai_reason: l.aiReason,
  ai_model: l.aiModel,
  ai_check_key: l.aiCheckKey,
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
  cardHash: r.card_hash ?? null,
  cardText: r.card_text ?? null,
  adType: r.ad_type ?? null,
  issues: r.issues ?? null,
  priceNote: r.price_note ?? null,
  marketMedian: r.market_median == null ? null : Number(r.market_median),
  marketCount: r.market_count ?? null,
  belowPct: r.below_pct ?? null,
  flagged: r.flagged ?? false,
  aiVerdict: r.ai_verdict ?? null,
  aiReason: r.ai_reason ?? null,
  aiModel: r.ai_model ?? null,
  aiCheckKey: r.ai_check_key ?? null,
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

/** Newest history row per listing. */
async function loadHistoryHeads(sb: SupabaseClient): Promise<HistoryHead[]> {
  const heads = new Map<string, HistoryHead>();
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from("listing_history")
      .select("id,listing_id,price_eur,hours")
      .order("id", { ascending: true })
      .range(from, from + 999);
    if (error) throw new Error(`Supabase history read failed: ${error.message}`);
    // ascending ids: a later row replaces the earlier one
    for (const r of data as any[]) {
      heads.set(r.listing_id, { id: r.id, listingId: r.listing_id, priceEur: r.price_eur == null ? null : Number(r.price_eur), hours: r.hours });
    }
    if (data.length < 1000) break;
  }
  return [...heads.values()];
}

/** Adds to the permanent history (see lib/history.ts for what counts as a change). */
export async function recordHistory(listings: Listing[], now: string): Promise<{ added: number; touched: number; removed: number }> {
  const sb = getSupabase();
  if (!sb) return { added: 0, touched: 0, removed: 0 };
  const plan = planHistory(listings, await loadHistoryHeads(sb), now);

  const rows = plan.insert.map(({ listing: l, firstSeen, lastSeen }) => ({
    listing_id: l.id,
    url: l.url,
    source: l.source,
    make: l.make,
    model: l.model,
    model_key: l.modelKey,
    model_label: l.modelLabel,
    wheeled: l.wheeled,
    year: l.year,
    price_eur: l.priceEur,
    hours: l.hours,
    location: l.location,
    ad_type: l.adType,
    price_note: l.priceNote,
    title: l.title,
    card_text: l.cardText,
    first_seen: firstSeen,
    last_seen: lastSeen,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from("listing_history").insert(rows.slice(i, i + 200));
    if (error) throw new Error(`Supabase history write failed: ${error.message}`);
  }
  for (let i = 0; i < plan.touch.length; i += 200) {
    const { error } = await sb.from("listing_history").update({ last_seen: now }).in("id", plan.touch.slice(i, i + 200));
    if (error) throw new Error(`Supabase history update failed: ${error.message}`);
  }
  if (plan.remove.length > 0) {
    const { error } = await sb.from("listing_history").delete().in("listing_id", plan.remove).is("ad_type", null);
    if (error) throw new Error(`Supabase history cleanup failed: ${error.message}`);
  }
  return { added: rows.length, touched: plan.touch.length, removed: plan.remove.length };
}
