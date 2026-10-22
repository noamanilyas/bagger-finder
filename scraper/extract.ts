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

/**
 * Free OpenRouter models, tried in order until one returns usable JSON.
 * Override with EXTRACT_MODELS="a,b,c" (comma separated OpenRouter model ids).
 */
const MODELS = (
  process.env.EXTRACT_MODELS ||
  "google/gemma-4-31b-it:free,nvidia/nemotron-3-super-120b-a12b:free,openrouter/free"
)
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const CHUNK = 20; // cards per request: small inputs keep small free models accurate

const SYSTEM = `You extract used-excavator listings from the text of cards on a German machinery marketplace search page.
Reply with ONLY a JSON object, no markdown and no commentary, in exactly this shape:
{"listings":[{"url":string,"title":string,"description":string|null,"make":string|null,"model":string|null,"priceEur":integer|null,"year":integer|null,"hours":integer|null,"location":string|null}]}
Rules:
- Only use information present in the cards. Never invent values; use null when unknown.
- "url" must be copied exactly from the card's url.
- priceEur is an integer in EUR, without dots or currency (null for "VB", "auf Anfrage" or if absent).
- year is the construction year (Baujahr / EZ), hours is operating hours (Betriebsstunden / Std.).
- location is the town, ideally "PLZ Town" (e.g. "12681 Berlin"); null if absent.
- make/model e.g. make "Doosan", model "DX55-9" ("Dosan" is a misspelling of Doosan).
- description: one short sentence summarising the card.
- Skip anything that is not a complete excavator for sale (spare parts, buckets, attachments, engines, ads, navigation links).
- If there are no excavator listings, reply {"listings":[]}.`;

export const hasAi = () => !!process.env.OPENROUTER_API_KEY;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pull a JSON object/array out of a model reply that may contain fences or chatter. */
function parseJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "");
  const start = Math.min(...["{", "["].map((c) => (t.indexOf(c) === -1 ? Infinity : t.indexOf(c))));
  const end = Math.max(t.lastIndexOf("}"), t.lastIndexOf("]"));
  if (!isFinite(start) || end <= start) throw new Error("no JSON in reply");
  return JSON.parse(t.slice(start, end + 1));
}

async function chat(model: string, user: string, withJsonMode: boolean): Promise<string> {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://github.com/noamanilyas/bagger-finder",
      "X-Title": "Bagger Finder",
    },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 6000,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: user },
      ],
      ...(withJsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (res.status === 400 && withJsonMode) return chat(model, user, false); // model/provider without JSON mode
  if (!res.ok) throw new Error(`${model}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[]; error?: { message?: string } };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${model}: empty reply ${data.error?.message ?? ""}`);
  return content;
}

async function viaAiChunk(blocks: Block[], sourceName: string): Promise<Extracted[]> {
  const cards = blocks.map((b) => ({ url: b.href, text: b.text }));
  const user = `Marketplace: ${sourceName}\nCards (JSON):\n${JSON.stringify(cards)}`;

  let lastErr: unknown;
  for (const model of MODELS) {
    try {
      const parsed = parseJson(await chat(model, user, true));
      const raw = (Array.isArray(parsed) ? parsed : (parsed as { listings?: unknown }).listings) as Partial<Extracted>[] | undefined;
      if (!Array.isArray(raw)) throw new Error(`${model}: unexpected JSON shape`);

      const byUrl = new Map(blocks.map((b) => [b.href, b]));
      const int = (v: unknown) => (typeof v === "number" && isFinite(v) ? Math.round(v) : null);
      const out: Extracted[] = [];
      for (const r of raw) {
        if (!r || typeof r.url !== "string" || typeof r.title !== "string") continue;
        const src = byUrl.get(r.url);
        if (!src) continue; // the model must not invent URLs
        out.push({
          url: r.url,
          title: r.title,
          description: typeof r.description === "string" ? r.description : null,
          make: typeof r.make === "string" ? r.make : null,
          model: typeof r.model === "string" ? r.model : null,
          priceEur: int(r.priceEur),
          year: int(r.year),
          hours: int(r.hours),
          location: typeof r.location === "string" ? r.location : null,
          imageUrl: src.img,
        });
      }
      return out;
    } catch (err) {
      lastErr = err;
      console.warn(`[extract] ${(err as Error).message} — trying next model`);
      await sleep(2000); // be gentle with the free-tier rate limit (20 requests/min)
    }
  }
  throw lastErr ?? new Error("no model available");
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
      const items: Extracted[] = [];
      for (let i = 0; i < blocks.length; i += CHUNK) {
        items.push(...(await viaAiChunk(blocks.slice(i, i + CHUNK), sourceName)));
      }
      return { items, via: "ai" };
    } catch (err) {
      console.warn(`[extract] AI extraction failed (${(err as Error).message}); using heuristic parser for this page`);
    }
  }
  return { items: viaHeuristic(blocks), via: "heuristic" };
}
