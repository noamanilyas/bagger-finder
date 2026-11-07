/**
 * Telling a refusal from a normal page. A site that refuses gets no more pages this run and is not tried in the
 * browser: getting past a bot check is not something this scraper does.
 */

/** Answers that mean "not you": unauthorised, forbidden, too many requests. 503 only counts with a bot check page. */
const REFUSAL_STATUS = new Set([401, 403, 429]);

/** Titles of bot check and block pages (Cloudflare, DataDome, Akamai, Imperva and the sites' own). */
const CHALLENGE =
  /just a moment|attention required|access denied|zugriff verweigert|security check|captcha|pardon our interruption|are you a (?:robot|human)|robot check|request blocked|request could not be satisfied|bot protection|verify you are human|checking your browser|ddos-guard/i;

/** Why a page counts as a refusal, or null for a normal page. `title` is the page's <title>. */
export function blockReason(status: number, title: string): string | null {
  const challenge = CHALLENGE.test(title);
  if (REFUSAL_STATUS.has(status)) return `refused (HTTP ${status}${challenge ? `, "${title.trim().slice(0, 60)}"` : ""})`;
  if (challenge) return `bot check page (HTTP ${status}, "${title.trim().slice(0, 60)}")`;
  return null;
}
