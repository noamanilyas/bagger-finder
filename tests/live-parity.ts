/**
 * Compares the current filters with the frozen ones on live cards from the original sources. Saves nothing.
 * Run with `npm run test:live` after changing the German word list: anything under LOST needs a good reason.
 */
import { CheerioCrawler, Configuration } from "crawlee";
import { SOURCES, isWheeled, matchModel, seedUrls } from "../lib/config";
import { collectBlocksCheerio } from "../scraper/cards";
import type { Block } from "../scraper/extract";
import { legacyIsWheeled, legacyMatchModel } from "./legacy-filters";

const PAGES_PER_SOURCE = 3;
const ORIGINAL = ["maschinensucher", "truckscout24", "kleinanzeigen", "machineryline"];

async function cardsOf(id: string): Promise<Block[]> {
  const source = SOURCES.find((s) => s.id === id)!;
  const cards: Block[] = [];
  const crawler = new CheerioCrawler(
    {
      maxConcurrency: 1,
      maxRequestRetries: 0,
      sameDomainDelaySecs: 3,
      async requestHandler({ $, request }) {
        cards.push(...collectBlocksCheerio($, request.loadedUrl ?? request.url, source.isListing, source.spacedText));
      },
      failedRequestHandler({ request }, error) {
        console.log(`FAILED ${request.url}: ${error.message.split("\n")[0]}`);
      },
    },
    new Configuration({ persistStorage: false }),
  );
  await crawler.run(seedUrls(source, false).slice(0, PAGES_PER_SOURCE));
  return cards;
}

async function main() {
  let lost = 0;
  for (const id of ORIGINAL) {
    const source = SOURCES.find((s) => s.id === id)!;
    const cards = await cardsOf(id);
    const row = { cards: cards.length, keptBefore: 0, keptNow: 0, same: 0, wheeledBefore: 0, wheeledNow: 0 };
    const gained: string[] = [];
    const gone: string[] = [];
    const notWheeled: string[] = [];
    for (const { text } of cards) {
      const before = legacyMatchModel(text)?.key ?? null;
      const now = matchModel(text, source.languages)?.key ?? null;
      if (before) row.keptBefore++;
      if (now) row.keptNow++;
      if (before === now) row.same++;
      else if (before) gone.push(`${before} -> ${now}: ${text.slice(0, 140)}`);
      else gained.push(`${now}: ${text.slice(0, 140)}`);
      if (legacyIsWheeled(text)) row.wheeledBefore++;
      if (isWheeled(text)) row.wheeledNow++;
      if (legacyIsWheeled(text) && !isWheeled(text)) notWheeled.push(text.slice(0, 140));
    }
    console.log(`\n${source.name}: ${JSON.stringify(row)}`);
    for (const g of gone) console.log(`  LOST ${g}`);
    for (const g of notWheeled) console.log(`  NO LONGER WHEELED ${g}`);
    for (const g of gained) console.log(`  gained ${g}`);
    lost += gone.length + notWheeled.length;
  }
  console.log(`\n${lost === 0 ? "Nothing lost." : `${lost} differences to look at.`}`);
  process.exitCode = lost === 0 ? 0 : 1;
}

void main();
