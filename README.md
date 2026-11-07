# Bagger Finder

Finds used excavators across Europe — **Yanmar 55 (including the wheeled B55W), Doosan DX55, Doosan DX140, Hyundai 140, Hyundai 55** — on several
marketplaces and shows them on a map: list with sorting and filters on the left, map on the right.

## How it works

| Part | Tech |
| --- | --- |
| Crawling | [Crawlee](https://crawlee.dev): plain HTTP + Cheerio first (cheap), headless Chromium via Playwright only for pages that come back empty or blocked; retries and rate limiting built in |
| Extraction | Gemini, Groq and free [OpenRouter](https://openrouter.ai) models in turn, each resting automatically when busy, turn listing cards into structured JSON; regex fallback when none is available |
| Geocoding | OpenStreetMap Nominatim, cached on disk |
| App | Next.js (App Router) + React + TypeScript, Leaflet map |

The scraper runs as a separate process (`scraper/run.ts`), started by the web app every hour (change this under
"Scraper settings"; the header shows the time left) and by the "Refresh now" button. Every run is recorded in the
Supabase table `scrape_runs`, and the next one is due one interval after the last started, so a restart does not
reset the timer and a missed scrape runs at startup. Results go to `data/listings.json`.

## Run locally

```bash
npm install
npx playwright install chromium
cp .env.example .env   # add OPENROUTER_API_KEY (free key from openrouter.ai/keys)
npm run dev            # http://localhost:3000
npm run scrape         # run the scraper once from the CLI
npm test               # filters, languages, countries and card parsers
```

## Customise

`lib/config.ts` holds the wanted models (name regexes) and the sources (search URLs). `lib/costs.ts` holds the cost estimates behind the "Pakistan cost" panel and the expected discount off asking prices (10–20%), which the budget filter also uses.

### Tell it about a machine

Press **Add comment** on a card. Comments like "we bought one of these for 20k" go in the Supabase table
`machine_knowledge`, not in the AI prompt. A comment applies to one ad, or to similar machines (model, wheeled or not,
a name part, a price limit). Code picks the comments that match an ad, and only those go to the AI for that ad.

- **Comment only:** shows on the card. The AI reads it if it reviews the machine anyway, for being below market.
- **Mark as interesting:** the machine is also reviewed and shown as a deal, even when the market comparison would not
  flag it.

Comments show in the app right away. The AI reviews matching machines on the next scrape. From the command line:

```bash
npm run knowledge                 # every comment and the current ads it matches
npm run knowledge -- add --model yanmar-55 --wheeled yes --contains b55w --max-price 30000 --interesting --note "We bought one for 20k"
npm run knowledge -- add --model yanmar-55 --listing 5ff75a5f81d74768 --note "Seller did not answer"
npm run knowledge -- remove 3
```

On a public server, set `APP_PASSWORD`. The browser then asks for it once (any user name), for the whole site except
`/api/health`, which is for the health check. Without it, production refuses to change comments.

### Add a marketplace

1. Add a `Source` to `lib/config.ts` with `enabled: false`, `spacedText: true`, its `languages`, and an `isListing` test
   so only real ads count. Set `defaultCountry` for a national site, or `null` when ads come from all over.
2. Try it. This reads the site without saving anything and without AI:
   ```bash
   npm run try-source -- mysite              # what would be kept or turned down, and why
   npm run try-source -- mysite --raw 5      # the text of five cards
   npm run try-source -- mysite --browser    # if plain HTTP finds no ads
   ```
3. The AI model reads any layout, but it has a limit per run, so also add a parser to `scraper/parsers.ts` for the
   rest. Copy real cards into `tests/parsers.test.ts`.
4. Check the site's `robots.txt`. Set `ai: false` if it asks that its content is not used with AI.
5. Set `enabled: true`.

### Add a language

Copy a file in `lib/languages/`, fill it in with its `examples`, add it to `index.ts` and `types.ts`, and run `npm test`.
The tests run your examples and look for clashes with the other languages.

- **Positive words** (excavator, wheeled, tracked) work on every source.
- **Exclusions** (rental, parts, wanted ads) work only on sources that declare the language, because one language's
  exclusion can be another's real machine: "location" is rental in French, "banden" is tyres in Dutch but part of
  "bandenkraan".

Prefer `partAtStart` to `notForSale` for parts, since real machines often mention "new tyres". After changing the German
list, also run `npm run test:live`, which compares the filters with the original ones on live cards.

Country names are in `lib/countries.ts`.

## Deploy (Render)

`render.yaml` + `Dockerfile` (Chromium needs Docker). Set `OPENROUTER_API_KEY` in the Render dashboard.

Notes:
- Render's free plan has 512 MB RAM and an ephemeral disk: Chromium is memory hungry (~800 MB seen), so it is only used as a fallback (use the Standard plan and `USE_BROWSER=true` if sites need it) and `data/` is wiped on each deploy (attach a disk and set `DATA_DIR` to keep history).
- Free OpenRouter models are limited (about 20 requests/min and 200/day per model); a scrape uses a few dozen requests, so a scrape every 6 hours fits.
- Check each marketplace's terms of use and robots.txt; the crawler is deliberately slow (1 page at a time, ≤20/min).
