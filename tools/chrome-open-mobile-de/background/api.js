// Calls to the local API. Only the background worker talks to it, because
// content scripts cannot make cross-origin requests to localhost reliably.
export const API_BASE = "http://localhost:3000/api";

// Asks the server whether a site is due. Returns { due, nextDueAt }.
export async function fetchDueStatus(site) {
  const url = `${API_BASE}/ingest/due?sites=${encodeURIComponent(site)}`;
  console.log(`[background] Due check request: ${url}`);

  const response = await fetch(url);
  console.log(`[background] Due check HTTP status: ${response.status}`);

  const data = await response.json();
  console.log("[background] Due check response:", data);
  return parseDueStatus(data, site);
}

// Expected shape: { due, sites: [{ site, due, nextDueAt, ... }] }
function parseDueStatus(data, site) {
  const entry = Array.isArray(data.sites) ? data.sites.find((s) => s.site === site) : null;

  let due = false;
  if (entry && typeof entry.due === "boolean") {
    due = entry.due;
  } else if (typeof data.due === "boolean") {
    due = data.due;
  } else {
    console.error("[background] Unrecognised due response:", data);
  }

  return { due, nextDueAt: entry && entry.nextDueAt ? entry.nextDueAt : null };
}

// Sends one site's listings to the ingest API in a single request.
export async function postIngest(site, machines) {
  const response = await fetch(`${API_BASE}/ingest`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ site, machines }),
  });
  const body = await response.text();
  return { ok: response.ok, status: response.status, body };
}
