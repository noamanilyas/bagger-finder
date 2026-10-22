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
 * Models you want tried first (comma separated OpenRouter ids, e.g. "google/gemma-4-31b-it:free").
 * After these, currently available free text models are discovered live from OpenRouter, because the
 * free line-up changes often; "openrouter/free" (OpenRouter's own router) is the last resort.
 */
const PREFERRED = (process.env.EXTRACT_MODELS || "google/gemma-4-31b-it:free")
  .split(",")
  .map((m) => m.trim())
  .filter(Boolean);

const CHUNK = 25; // cards per request: small inputs keep small free models accurate
const MAX_MODELS = 8;
const CHUNK_DEADLINE_MS = 50_000; // give up on AI for a chunk after this long (free models are flaky)
const MAX_TRIES_PER_CHUNK = 3;
const MAX_FAILS_PER_MODEL = 2; // then the model is skipped for the rest of the run
const MAX_FAILED_CHUNKS_IN_A_ROW = 2; // then AI is switched off for the rest of the run

const failures = new Map<string, number>();
let failedChunksInARow = 0;
let aiDisabled = false;

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

// ---- model selection -------------------------------------------------------------------------

type OrModel = {
  id: string;
  context_length?: number;
  supported_parameters?: string[];
  architecture?: { output_modalities?: string[] };
};

let discovered: string[] | null = null;
const dead = new Set<string>(); // models that returned 404 / are gone for this run
const cooling = new Map<string, number>(); // model -> timestamp until which we skip it (after a 429)

async function discoverFreeModels(): Promise<string[]> {
  if (discovered) return discovered;
  try {
    const res = await fetch("https://openrouter.ai/api/v1/models", { signal: AbortSignal.timeout(20_000) });
    const data = (await res.json()) as { data?: OrModel[] };
    const bad = /safety|guard|vision|\bvl\b|omni|embed|rerank|decide|span-|code|coder|image|audio|tts/i;
    const liked = /gemma|llama|qwen|mistral|deepseek|gpt-oss|glm|kimi|nemotron/i;
    const score = (m: OrModel) =>
      (m.supported_parameters?.includes("structured_outputs") ? 2 : 0) +
      (m.supported_parameters?.includes("response_format") ? 1 : 0) +
      (liked.test(m.id) ? 1 : 0);
    discovered = (data.data ?? [])
      .filter((m) => m.id.endsWith(":free") && liked.test(m.id) && !bad.test(m.id) && (m.context_length ?? 0) >= 32_000)
      .filter((m) => (m.architecture?.output_modalities ?? ["text"]).every((o) => o === "text"))
      .sort((a, b) => score(b) - score(a))
      .map((m) => m.id);
  } catch (err) {
    console.warn(`[extract] could not list OpenRouter models: ${(err as Error).message}`);
    discovered = [];
  }
  return discovered;
}

async function modelOrder(): Promise<string[]> {
  const all = [...PREFERRED, ...(await discoverFreeModels()), "openrouter/free"];
  return [...new Set(all)].filter((m) => !dead.has(m)).slice(0, MAX_MODELS);
}

// ---- OpenRouter call -------------------------------------------------------------------------

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
    signal: AbortSignal.timeout(25_000),
  });
  if (res.status === 400 && withJsonMode) return chat(model, user, false); // model/provider without JSON mode
  if (!res.ok) throw new Error(`${model}: HTTP ${res.status} ${(await res.text()).slice(0, 120)}`);
  const data = (await res.json()) as { choices?: { message?: { content?: string | null } }[]; error?: { message?: string } };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${model}: empty reply ${data.error?.message ?? ""}`.trim());
  return content;
}

async function viaAiChunk(blocks: Block[], sourceName: string): Promise<Extracted[]> {
  const cards = blocks.map((b) => ({ url: b.href, text: b.text }));
  const user = `Marketplace: ${sourceName}\nCards (JSON):\n${JSON.stringify(cards)}`;

  let lastErr: unknown = new Error("no model available");
  const started = Date.now();
  let tried = 0;
  const outOfBudget = () => Date.now() - started > CHUNK_DEADLINE_MS || tried >= MAX_TRIES_PER_CHUNK;

  for (let round = 0; round < 2 && !outOfBudget(); round++) {
    const models = await modelOrder();
    const ready = models.filter((m) => (cooling.get(m) ?? 0) <= Date.now());
    if (ready.length === 0 && models.length > 0) {
      // everything is rate limited: wait briefly for the earliest one to recover
      const wait = Math.min(...models.map((m) => (cooling.get(m) ?? 0) - Date.now()));
      await sleep(Math.min(Math.max(wait, 1000), 10_000));
      continue;
    }
    for (const model of ready) {
      if (outOfBudget()) break;
      tried++;
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
        console.log(`[extract] ${model}: ${out.length} listings from ${blocks.length} cards`);
        return out;
      } catch (err) {
        lastErr = err;
        const msg = (err as Error).message;
        if (/HTTP (404|410)/.test(msg)) dead.add(model);
        if (/HTTP 429/.test(msg)) cooling.set(model, Date.now() + 60_000);
        const n = (failures.get(model) ?? 0) + 1;
        failures.set(model, n);
        if (n >= MAX_FAILS_PER_MODEL) dead.add(model);
        console.warn(`[extract] ${msg.slice(0, 160)} — trying next model`);
        await sleep(1500);
      }
    }
  }
  throw lastErr;
}

// ---- fallback --------------------------------------------------------------------------------

/** Fallback without an AI answer: regexes over the card text. Rougher, but works offline. */
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
  if (!hasAi() || aiDisabled) return { items: viaHeuristic(blocks), via: "heuristic" };

  const items: Extracted[] = [];
  let aiChunks = 0;
  for (let i = 0; i < blocks.length; i += CHUNK) {
    const chunk = blocks.slice(i, i + CHUNK);
    if (aiDisabled) {
      items.push(...viaHeuristic(chunk));
      continue;
    }
    try {
      items.push(...(await viaAiChunk(chunk, sourceName)));
      aiChunks++;
      failedChunksInARow = 0;
    } catch (err) {
      console.warn(`[extract] AI failed for ${chunk.length} cards (${(err as Error).message.slice(0, 120)}); using heuristic parser for them`);
      items.push(...viaHeuristic(chunk));
      if (++failedChunksInARow >= MAX_FAILED_CHUNKS_IN_A_ROW) {
        aiDisabled = true;
        console.warn("[extract] free models keep failing — AI switched off for the rest of this run");
      }
    }
  }
  return { items, via: aiChunks > 0 ? "ai" : "heuristic" };
}
