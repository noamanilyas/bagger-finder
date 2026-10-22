# Bagger Finder

Finds used excavators in Germany — **Yanmar 55, Doosan DX55, Doosan DX140, Hyundai 140, Hyundai 55** — on several
marketplaces and shows them on a map: list with sorting and filters on the left, map on the right.

## How it works

| Part | Tech |
| --- | --- |
| Crawling | [Crawlee](https://crawlee.dev) + Playwright (headless Chromium): retries, rate limiting, JavaScript-rendered pages |
| Extraction | Claude (`EXTRACT_MODEL`, default `claude-haiku-5-5`) turns listing cards into structured data; regex fallback without an API key |
| Geocoding | OpenStreetMap Nominatim, cached on disk |
| App | Next.js (App Router) + React + TypeScript, Leaflet map |

The scraper runs as a separate process (`scraper/run.ts`), started by the web app on boot, every 6 hours, and by the
"Refresh now" button. Results go to `data/listings.json`.

## Run locally

```bash
npm install
npx playwright install chromium
cp .env.example .env   # add ANTHROPIC_API_KEY
npm run dev            # http://localhost:3000
npm run scrape         # run the scraper once from the CLI
```

## Customise

`lib/config.ts` holds the wanted models (name regexes) and the sources (search URLs). To add a marketplace, add a
`Source` there — no site-specific selectors are needed because Claude reads the page cards.

## Deploy (Render)

`render.yaml` + `Dockerfile` (Chromium needs Docker). Set `ANTHROPIC_API_KEY` in the Render dashboard.

Notes:
- Render's free plan has 512 MB RAM and an ephemeral disk: Chromium can run out of memory (use the Standard plan if
  scrapes crash) and `data/` is wiped on each deploy (attach a disk and set `DATA_DIR` to keep history).
- Check each marketplace's terms of use and robots.txt; the crawler is deliberately slow (1 page at a time, ≤20/min).
