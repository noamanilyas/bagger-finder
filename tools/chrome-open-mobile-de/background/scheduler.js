// Automatic runs: one alarm per site, set to the server's nextDueAt.
// Never sooner than 15 minutes from now, so a site that is still not due
// does not reopen its tab in a loop.
const MIN_DELAY_MS = 15 * 60 * 1000;
const PREFIX = "due:";

export function siteFromAlarm(name) {
  return name.startsWith(PREFIX) ? name.slice(PREFIX.length) : null;
}

export function scheduleSite(site, nextDueAt) {
  const parsed = Date.parse(nextDueAt);
  if (Number.isNaN(parsed)) {
    console.error(`[background] Invalid nextDueAt for ${site}:`, nextDueAt);
    return;
  }

  const when = Math.max(parsed, Date.now() + MIN_DELAY_MS);
  chrome.alarms.create(PREFIX + site, { when });
  console.log(`[background] Next due check for ${site} at ${new Date(when).toISOString()}`);
}
