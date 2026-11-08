/**
 * When machines from each external site last arrived (see lib/external-sites.ts). Kept beside the scraper's own sites
 * in source_health (or its file in the data folder), under "external:<site>", so no new table is needed.
 */
import { loadHealth, saveHealth } from "./source-health";

const PREFIX = "external:";

/** Last arrival by site. */
export async function loadLastReceived(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  for (const [key, h] of Object.entries(await loadHealth())) {
    if (key.startsWith(PREFIX) && h.lastReadAt) out[key.slice(PREFIX.length)] = h.lastReadAt;
  }
  return out;
}

export async function markReceived(sites: Iterable<string>, at: string): Promise<void> {
  for (const site of new Set(sites)) await saveHealth(`${PREFIX}${site}`, { blockedUntil: null, strikes: 0, lastError: null, lastReadAt: at });
}
