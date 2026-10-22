import Anthropic from "@anthropic-ai/sdk";

/** A candidate listing card pulled from the page DOM: the link, the card text and a thumbnail. */
export type Block = { href: string; text: string; img: string | null };

export type Extracted = {
  url: string;
  title: string;
  description: string | null;
  make: string | null;
  model: string | null;
  priceEur: number | null;
  year: number | null;
  hours: number | null;
  location: string | null;
  imageUrl: string | null;
};

const MODEL = process.env.EXTRACT_MODEL || "claude-haiku-5-5";

const SYSTEM = `You extract used-excavator listings from the text of cards on a German machinery marketplace search page.
Rules:
- Only use information present in the cards. Never invent values; use null when unknown.
- "url" must be copied exactly from the card's url.
- priceEur is an integer in EUR (null for "VB", "auf Anfrage" or if absent).
- year is the construction year (Baujahr / EZ), hours is operating hours (Betriebsstunden / Std.).
- location is the town, ideally "PLZ Town" (e.g. "12681 Berlin"); null if absent.
- make/model e.g. make "Doosan", model "DX55-9" ("Dosan" is a misspelling of Doosan).
- Skip anything that is not a complete excavator for sale (spare parts, buckets, attachments, engines, ads, navigation links).`;

const TOOL = {
  name: "record_listings",
  description: "Record the excavator listings found on the page.",
  input_schema: {
    type: "object" as const,
    properties: {
      listings: {
        type: "array",
        items: {
          type: "object",
          properties: {
            url: { type: "string" },
            title: { type: "string" },
            description: { type: ["string", "null"], description: "1-2 sentence summary of the card" },
            make: { type: ["string", "null"] },
            model: { type: ["string", "null"] },
            priceEur: { type: ["integer", "null"] },
            year: { type: ["integer", "null"] },
            hours: { type: ["integer", "null"] },
            location: { type: ["string", "null"] },
          },
          required: ["url", "title"],
        },
      },
    },
    required: ["listings"],
  },
};

export const hasAi = () => !!process.env.ANTHROPIC_API_KEY;

let client: Anthropic | null = null;

async function viaAi(blocks: Block[], sourceName: string): Promise<Extracted[]> {
  client ??= new Anthropic();
  const cards = blocks.map((b, i) => ({ i, url: b.href, text: b.text }));
  const params = {
    model: MODEL,
    max_tokens: 8000,
    system: SYSTEM,
    tools: [TOOL],
    tool_choice: { type: "tool", name: TOOL.name },
    messages: [
      {
        role: "user",
        content: `Marketplace: ${sourceName}\nCards (JSON):\n${JSON.stringify(cards)}`,
      },
    ],
  } as Anthropic.MessageCreateParamsNonStreaming;

  const msg = await client.messages.create(params);
  const block = msg.content.find((c) => c.type === "tool_use");
  if (!block || block.type !== "tool_use") return [];

  const raw = (block.input as { listings?: Partial<Extracted>[] }).listings ?? [];
  const byUrl = new Map(blocks.map((b) => [b.href, b]));
  const out: Extracted[] = [];
  for (const r of raw) {
    if (!r.url || !r.title) continue;
    const src = byUrl.get(r.url);
    if (!src) continue; // the model must not invent URLs
    out.push({
      url: r.url,
      title: r.title,
      description: r.description ?? null,
      make: r.make ?? null,
      model: r.model ?? null,
      priceEur: typeof r.priceEur === "number" ? r.priceEur : null,
      year: typeof r.year === "number" ? r.year : null,
      hours: typeof r.hours === "number" ? r.hours : null,
      location: r.location ?? null,
      imageUrl: src.img,
    });
  }
  return out;
}

/** Fallback without an API key: regexes over the card text. Rougher, but works offline. */
function viaHeuristic(blocks: Block[]): Extracted[] {
  return blocks.map((b) => {
    const t = b.text;
    const price = t.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{4,7})\s*(?:€|EUR)/i);
    const year = t.match(/\b(19[89]\d|20[0-3]\d)\b/);
    const hours = t.match(/(\d{1,3}(?:[.\s]\d{3})+|\d{2,6})\s*(?:h\b|std|betriebsstunden)/i);
    const loc = t.match(/\b(\d{5})\s+([A-ZÄÖÜ][\wäöüß.-]+(?:\s[A-ZÄÖÜ][\wäöüß.-]+)?)/);
    return {
      url: b.href,
      title: t.slice(0, 90),
      description: t.slice(0, 280),
      make: null,
      model: null,
      priceEur: price ? parseInt(price[1].replace(/[.\s]/g, ""), 10) : null,
      year: year ? parseInt(year[1], 10) : null,
      hours: hours ? parseInt(hours[1].replace(/[.\s]/g, ""), 10) : null,
      location: loc ? `${loc[1]} ${loc[2]}` : null,
      imageUrl: b.img,
    };
  });
}

export async function extract(
  blocks: Block[],
  sourceName: string,
): Promise<{ items: Extracted[]; via: "ai" | "heuristic" }> {
  if (blocks.length === 0) return { items: [], via: hasAi() ? "ai" : "heuristic" };
  if (hasAi()) {
    try {
      return { items: await viaAi(blocks, sourceName), via: "ai" };
    } catch (err) {
      console.warn(`[extract] AI extraction failed (${(err as Error).message}); using heuristic parser`);
    }
  }
  return { items: viaHeuristic(blocks), via: "heuristic" };
}
