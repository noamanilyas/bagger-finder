# TODO

## TruckScout24: plain fetch and real browser show different results (investigate later)

**Observed (2026-10-22/23)** on `https://www.truckscout24.de/baumaschinen/gebraucht/mobilbagger/doosan`:
- A plain HTTP fetch (what the Cheerio phase of the scraper sees) returns 165 results, but the top cards are mostly
  crawlers, forklifts, light masts and a compactor. Distances on the cards look like they are measured from Frankfurt.
- A real browser (Berlin) shows the same 165 results, but the top cards are real Mobilbagger (DX140W-3, DX170W-5, DX165W-5 ...).
- Likely cause: location/cookie based "Relevanz" ranking and/or content changed by JavaScript after load.
  Render's server is in Frankfurt, so the scraper would get the "plain fetch" view.

**Ideas to try**
- [ ] Find a stable sort and/or fixed location via URL parameters (e.g. sort by newest) so every client gets the same order.
- [ ] Look for the JSON data the page loads in the background (network requests) and read that instead of the HTML.
- [ ] Always use the real browser (Playwright) for TruckScout24 instead of Cheerio-first; check memory/runtime on the Render free plan.
- [ ] Page through all results (165 over many pages) so the starting order matters less.
- [ ] Possibly a Chrome extension (runs in the user's own browser) that collects listings and sends them to the app.

**Related cleanup**
- [ ] Remove the rule in `scraper/run.ts` that tags every listing from a `/mobilbagger/` URL as wheeled
      (that page also contains crawlers); rely on the model name / the word "Mobilbagger" instead.
- [ ] The `/mobilbagger/yanmar` and `/mobilbagger/hyundai` TruckScout24 URLs are unverified guesses.

## Other open items
- [ ] Auto-scrape is switched off on Render (`AUTO_SCRAPE=false`). Turn it back on after testing.
- [ ] Optional "new / factory-new" flag so new machines can be hidden.
- [ ] Decide whether to widen the model list (any Doosan/Hyundai wheeled excavator except 150/170 class).
