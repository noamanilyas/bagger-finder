import { isSaleAd } from "./market";
import type { Listing } from "./types";

/** A comment from the buyer, on one ad or on similar machines. Stored in the machine_knowledge table. */
export type KnowledgeNote = {
  id: number;
  /** true: matching ads count as deals and get an AI review. false: a comment the AI reads if it reviews the ad anyway. */
  interesting: boolean;
  /** set: applies to this ad only, and the limits below are not used */
  listingId: string | null;
  /** key of the wanted model (see lib/config.ts) */
  modelKey: string;
  /** true: wheeled only; false: not wheeled; null: both */
  wheeled: boolean | null;
  /** narrows a broad model key: "b55w" keeps B 55W-2 and B55 W-1 but not ViO55. Spaces and hyphens are ignored. */
  modelContains: string | null;
  /** above this price the note does not apply; ads without a price do not match either */
  maxPriceEur: number | null;
  note: string;
};

const squash = (s: string) => s.toLowerCase().replace(/[\s-]/g, "");

/** The notes that apply to this ad. Only these reach the AI, so the prompt stays small however many notes exist. */
export function notesFor(l: Listing, notes: KnowledgeNote[]): KnowledgeNote[] {
  if (!isSaleAd(l)) return [];
  const name = squash(`${l.title} ${l.model ?? ""}`);
  return notes.filter((n) =>
    n.listingId != null
      ? n.listingId === l.id
      : n.modelKey === l.modelKey &&
        (n.wheeled == null || n.wheeled === l.wheeled) &&
        (n.modelContains == null || name.includes(squash(n.modelContains))) &&
        (n.maxPriceEur == null || (l.priceEur != null && l.priceEur <= n.maxPriceEur)),
  );
}

/** Adds the matching notes for the app to show. Worked out on reading, so nothing extra is stored on listings. */
export function withKnowledge(listings: Listing[], notes: KnowledgeNote[]): Listing[] {
  return listings.map((l) => {
    const knowledge = notesFor(l, notes).map((n) => ({ id: n.id, note: n.note, interesting: n.interesting, thisAdOnly: n.listingId != null }));
    return knowledge.length > 0 ? { ...l, knowledge } : l;
  });
}

const MAX_NOTE_LENGTH = 500;

/** Checks a new note from the app or the command line. Throws a message fit to show. */
export function validateNote(input: unknown, modelKeys: string[]): Omit<KnowledgeNote, "id"> {
  const v = (input ?? {}) as Record<string, unknown>;
  if (typeof v.modelKey !== "string" || !modelKeys.includes(v.modelKey)) throw new Error(`Model must be one of: ${modelKeys.join(", ")}`);
  if (v.wheeled != null && typeof v.wheeled !== "boolean") throw new Error("Wheeled must be true, false or empty");
  if (v.modelContains != null && typeof v.modelContains !== "string") throw new Error("Name part must be text");
  if (v.maxPriceEur != null && !(typeof v.maxPriceEur === "number" && Number.isFinite(v.maxPriceEur) && v.maxPriceEur > 0)) {
    throw new Error("Price limit must be a number of euros");
  }
  const note = typeof v.note === "string" ? v.note.trim() : "";
  if (!note) throw new Error("The note is empty");
  if (note.length > MAX_NOTE_LENGTH) throw new Error(`The note is longer than ${MAX_NOTE_LENGTH} characters`);
  if (v.interesting != null && typeof v.interesting !== "boolean") throw new Error("Interesting must be true or false");
  if (v.listingId != null && (typeof v.listingId !== "string" || !/^[\w-]{1,64}$/.test(v.listingId))) throw new Error("That is not an ad id");
  const interesting = (v.interesting as boolean | null | undefined) ?? false;
  if (v.listingId != null) {
    return { interesting, listingId: v.listingId as string, modelKey: v.modelKey, wheeled: null, modelContains: null, maxPriceEur: null, note };
  }
  const contains = (v.modelContains as string | null | undefined)?.trim() ?? "";
  return {
    interesting,
    listingId: null,
    modelKey: v.modelKey,
    wheeled: (v.wheeled as boolean | null | undefined) ?? null,
    // only spaces or hyphens would match every ad of the model, which is what empty says openly
    modelContains: squash(contains) ? contains : null,
    maxPriceEur: (v.maxPriceEur as number | null | undefined) ?? null,
    note,
  };
}

/**
 * The text saved from a card. The buyer's own words stand alone on one ad. On similar machines they also say which ad
 * they came from, since "Good price" means nothing on another machine otherwise.
 */
export function commentText(l: Pick<Listing, "title" | "year" | "priceEur">, picks: string[], text: string, similar: boolean): string {
  const machine = [l.title.slice(0, 80), l.year, l.priceEur != null ? `€${l.priceEur.toLocaleString("en-US")}` : null].filter(Boolean).join(", ");
  const words = [...picks.map((p) => `${p}.`), text.trim()].filter(Boolean).join(" ");
  if (!words) return `Marked interesting: ${machine}.`;
  return similar ? `${words} (on ${machine})` : words;
}

/** Where the button's price limit starts: the ad's price plus 10%, rounded up to the next €1,000. */
export const suggestedMaxPrice = (priceEur: number | null): number | null => (priceEur == null ? null : Math.ceil((priceEur * 1.1) / 1000) * 1000);
