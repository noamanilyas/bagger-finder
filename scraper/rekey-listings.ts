/**
 * One-off repair: ads stored under an id made from an uncleaned address (mobile.de links with the search they were
 * opened from) are merged into the row under their clean id. Any fact one copy has is kept, the newest copy's value
 * winning; first seen is the earliest, last seen the latest. Prints what it would do; saves only with --apply.
 *   npm run rekey-listings
 *   npm run rekey-listings -- --apply
 */
import fs from "node:fs";
import path from "node:path";
import { listingId, normalizeUrl } from "../lib/listing-id";
import { deleteListings, hasSupabase, loadListings, saveListings } from "../lib/supabase";
import { DATA_DIR } from "../lib/store";
import type { Listing } from "../lib/types";

const empty = (v: unknown) => v == null || v === "";

/** One row from all stored copies of an ad, newest first. */
export function mergeCopies(id: string, copies: Listing[]): Listing {
  const newest = [...copies].sort((a, b) => b.lastSeen.localeCompare(a.lastSeen));
  const out = { ...newest[0] } as Record<string, unknown>;
  for (const k of Object.keys(out)) {
    if (!empty(out[k])) continue;
    const from = newest.find((l) => !empty((l as Record<string, unknown>)[k]));
    if (from) out[k] = (from as Record<string, unknown>)[k];
  }
  // The price travels with its currency.
  const priced = newest.find((l) => l.priceEur != null);
  if (priced) Object.assign(out, { priceEur: priced.priceEur, priceAmount: priced.priceAmount ?? null, priceCurrency: priced.priceCurrency ?? null });
  return {
    ...(out as Listing),
    id,
    url: normalizeUrl(newest[0].url),
    firstSeen: copies.map((l) => l.firstSeen).sort()[0],
    lastSeen: newest[0].lastSeen,
  };
}

async function main() {
  if (!hasSupabase()) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY are needed");
  const apply = process.argv.includes("--apply");
  const all = await loadListings();
  const byAd = new Map<string, Listing[]>();
  for (const l of all) {
    const id = listingId(l.url);
    (byAd.get(id) ?? byAd.set(id, []).get(id)!).push(l);
  }
  const merged: Listing[] = [];
  const stale: string[] = [];
  const backup: Listing[] = [];
  for (const [id, copies] of byAd) {
    if (copies.length === 1 && copies[0].id === id && copies[0].url === normalizeUrl(copies[0].url)) continue;
    const row = mergeCopies(id, copies);
    merged.push(row);
    backup.push(...copies);
    stale.push(...copies.filter((l) => l.id !== id).map((l) => l.id));
    const price = row.priceEur != null ? `€${row.priceEur.toLocaleString("de-DE")}` : "no price";
    console.log(`${id.slice(0, 8)} <- ${copies.map((l) => l.id.slice(0, 8)).join(", ")}  ${row.title} · ${price} · ${row.year ?? "-"} · ${row.hours ?? "-"} h`);
  }
  console.log(`${all.length} rows: ${merged.length} ads to merge, ${stale.length} old rows to remove`);
  if (!apply) {
    console.log("Nothing saved. Run with --apply to save.");
    return;
  }
  const file = path.join(DATA_DIR, `rekey-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.json`);
  fs.writeFileSync(file, JSON.stringify(backup, null, 1));
  console.log(`backup of the rows before: ${file}`);
  await saveListings(merged);
  await deleteListings(stale);
  console.log("saved");
}

if (process.argv[1]?.endsWith("rekey-listings.ts")) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
