# Listing Collector (Chrome extension)

An unpacked Chrome extension. It collects listings from the search pages of each configured site and sends them to the local API in one request per run.

## Layout

```
manifest.json                 version, permissions, and which pages get which scripts
background/
  sites.js                    site registry: each site and its list of search page URLs
  api.js                      local API calls: due check and ingest
  scheduler.js                automatic run alarms (one per site)
  index.js                    service worker entry: toolbar icon, alarms, message routing
content/
  core/
    util.js                   delays and waiting helpers
    state.js                  run progress, saved in sessionStorage
    messages.js               messages to the background (due check, ingest)
    collector.js              run engine: rewind, scroll, paging, URLs, one send at the end
  sites/
    mobile-de.js              mobile.de page structure: selectors, field extraction, API mapping
```

## How a run works

1. A site's search page loads. Its content script asks the background whether the site is due.
2. If it is due, the script starts on the site's first URL, goes back to page 1, scrolls to the end, reads the page, clicks **Further**, and repeats. When a URL's pages are done, it moves to the next URL in the site's list.
3. When every URL is done, the script sends all listings for the site in one request to `/api/ingest`. It then asks the due check again so the next run is scheduled.
4. The background sets an alarm for the site's `nextDueAt`. When the alarm fires, it opens the site's first URL in a background tab, and step 1 starts.

## Adding a site

1. `background/sites.js`: add an entry with `name` and `urls` (one or more search page URLs, in the order to collect them).
2. `content/sites/<site>.js`: write an adapter with the same methods as `mobile-de.js`: `id`, `listingElements`, `firstListingKey`, `nextButton`, `previousButton`, `pageIndicator`, `extractListing`, and `toMachine`. End the file with `window.Collector.start(adapter)`.
3. `manifest.json`: add a `content_scripts` entry for the site's search page `matches`. List the four `content/core/` files first, then the site file.
4. Add `host_permissions` only if the site needs one. The local API address is already allowed.
5. Bump the version (see Versioning).

## Local API

`background/api.js` sets `API_BASE` (default `http://localhost:3000/api`). The endpoints used are `GET /ingest/due?sites=<site>` and `POST /ingest` with `{ site, machines }`.

## Logs

- Page logs (run progress, due decision, per-page reads) appear in the mobile.de page's **Console**.
- Background logs (due check requests, HTTP status, responses, alarms) appear in the service worker console. Open `chrome://extensions`, find the extension, and click **service worker** under **Inspect views**.

## Versioning

The version in `manifest.json` follows `MAJOR.MINOR.PATCH`. Bump it with every change to this folder:

- **MAJOR** (e.g. 1.1.0 → 2.0.0): breaking change, such as a different search URL, removed behaviour, or a change to what the extension needs permission for.
- **MINOR** (e.g. 1.1.0 → 1.2.0): new feature, such as a new script, a new page it works on, or new logging.
- **PATCH** (e.g. 1.1.0 → 1.1.1): bug fix, wording change, or documentation-only update.

When the version goes up, reset lower numbers to 0 (e.g. 1.4.2 → 2.0.0 or 1.5.0). After updating, click **Reload** on the extension in `chrome://extensions`.

## Notice for AI models and automated agents

Do not read, open, modify, load, or otherwise access anything in this folder (`tools/chrome-open-mobile-de/`), including this README. This tool is not to be used or inspected by any AI model or automated agent. If a task seems to require it, stop and ask the owner instead.
