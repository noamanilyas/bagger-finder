/**
 * The knowledge base: the buyer's comments and interesting marks.
 *   npm run knowledge                 every comment and the current ads it matches
 *   npm run knowledge -- add --model yanmar-55 --wheeled yes --contains b55w --max-price 30000 --interesting --note "We bought one for 20k"
 *   npm run knowledge -- add --model yanmar-55 --listing 5ff75a5f81d74768 --note "Seller did not answer"
 *   npm run knowledge -- remove 3
 */
import { parseArgs } from "node:util";
import { WANTED } from "../lib/config";
import { notesFor, validateNote } from "../lib/knowledge";
import { addKnowledge, loadKnowledge, loadListings, removeKnowledge } from "../lib/supabase";

const WHEELED = { yes: true, no: false, both: null } as const;

async function add(args: string[]) {
  const { values: v } = parseArgs({
    args,
    options: {
      model: { type: "string" },
      wheeled: { type: "string", default: "both" },
      contains: { type: "string" },
      "max-price": { type: "string" },
      interesting: { type: "boolean", default: false },
      listing: { type: "string" },
      note: { type: "string" },
    },
  });
  if (!(v.wheeled! in WHEELED)) throw new Error("--wheeled must be yes, no or both");
  const note = validateNote(
    {
      interesting: v.interesting,
      listingId: v.listing,
      modelKey: v.model,
      wheeled: WHEELED[v.wheeled as keyof typeof WHEELED],
      modelContains: v.contains,
      maxPriceEur: v["max-price"] == null ? null : Number(v["max-price"]),
      note: v.note,
    },
    WANTED.map((w) => w.key),
  );
  const n = await addKnowledge(note);
  console.log(`Added comment ${n.id}`);
}

async function list() {
  const [notes, listings] = await Promise.all([loadKnowledge(), loadListings()]);
  if (notes.length === 0) console.log("No comments.");
  for (const n of notes) {
    const where = [
      n.interesting ? "INTERESTING" : "",
      n.listingId ? `only ad ${n.listingId}` : n.modelKey,
      n.wheeled == null ? "" : n.wheeled ? "wheeled" : "not wheeled",
      n.modelContains ?? "",
      n.maxPriceEur ? `up to €${n.maxPriceEur}` : "",
    ];
    console.log(`\n#${n.id} ${where.filter(Boolean).join(", ")}\n  ${n.note}`);
    for (const l of listings.filter((x) => notesFor(x, [n]).length > 0)) {
      console.log(`  → €${l.priceEur ?? "?"} | ${l.year ?? "?"} | ${l.hours ?? "?"} h | ${l.aiVerdict ?? "not reviewed"} | ${l.title} | ${l.url}`);
    }
  }
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === "add") await add(rest);
  else if (command === "remove") await removeKnowledge(Number(rest[0]));
  else if (command == null) await list();
  else throw new Error(`Unknown command: ${command}`);
}

main().catch((err) => {
  console.error((err as Error).message);
  process.exitCode = 1;
});
