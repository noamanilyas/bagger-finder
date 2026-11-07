"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { commentText, notesFor, suggestedMaxPrice } from "@/lib/knowledge";
import type { Listing } from "@/lib/types";

const PICKS = ["Good price", "Good model", "Good engine"];

const adsText = (n: number) => `${n} current ${n === 1 ? "ad" : "ads"}`;

async function send(url: string, init: RequestInit): Promise<string | null> {
  const res = await fetch(url, init).catch(() => null);
  if (res?.ok) return null;
  const body = (await res?.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? "Could not save. Try again.";
}

export const StarIcon = ({ filled = false, size = 18 }: { filled?: boolean; size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" />
  </svg>
);

/** True when one of the buyer's comments marks this ad interesting. */
export const isMarked = (l: Listing) => !!l.knowledge?.some((k) => k.interesting);

type Props = {
  listing: Listing;
  all: Listing[];
  onChange: () => Promise<void>;
  onClose: () => void;
  /** why this machine stands out (price check, notes, AI), shown above the form */
  summary?: string | null;
};

/**
 * The one place to comment on a machine or mark it interesting, as a dialog opened from a card's star or the map popup.
 * Saves to the knowledge base, so similar ads can count too.
 */
export default function AddComment({ listing: l, all, onChange, onClose, summary }: Props) {
  const [picks, setPicks] = useState<string[]>([]);
  const [text, setText] = useState("");
  // opened from a star, so marking is the likely intent; untick it to only leave a comment
  const [interesting, setInteresting] = useState(true);
  const [similar, setSimilar] = useState(false);
  const [contains, setContains] = useState(l.model ?? "");
  const [maxPrice, setMaxPrice] = useState(String(suggestedMaxPrice(l.priceEur) ?? ""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const scope = similar
    ? { listingId: null, wheeled: l.wheeled, modelContains: contains.trim() || null, maxPriceEur: parseInt(maxPrice, 10) || null }
    : { listingId: l.id, wheeled: null, modelContains: null, maxPriceEur: null };
  const matching = similar ? all.filter((x) => notesFor(x, [{ id: 0, note: "", interesting, modelKey: l.modelKey, ...scope }]).length > 0).length : 0;
  const canSave = interesting || picks.length > 0 || text.trim() !== "";

  const save = async () => {
    setBusy(true);
    setError(null);
    const failed = await send("/api/knowledge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ modelKey: l.modelKey, interesting, ...scope, note: commentText(l, picks, text, similar) }),
    });
    if (failed) {
      setError(failed);
      setBusy(false);
      return;
    }
    await onChange();
    onClose();
  };

  const remove = async (id: number) => {
    const covered = all.filter((x) => x.knowledge?.some((k) => k.id === id)).length;
    if (!window.confirm(`Remove this comment? It applies to ${adsText(covered)}.`)) return;
    setBusy(true);
    setError(null);
    const failed = await send(`/api/knowledge?id=${id}`, { method: "DELETE" });
    if (failed) setError(failed);
    else await onChange();
    setBusy(false);
  };

  const facts = [l.year, l.hours != null ? `${l.hours.toLocaleString("de-DE")} h` : null, l.location].filter(Boolean).join(" · ");
  const titleId = `comment-title-${l.id}`;

  return createPortal(
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2 id={titleId}>
            <span className="star-mark"><StarIcon filled size={20} /></span>
            Mark as interesting
          </h2>
          <button className="btn ghost icon" aria-label="Close" onClick={onClose}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>

        <div className="dialog-summary">
          <div className="title-row">
            <span className="dialog-title">{l.title}</span>
            <strong className="price">{l.priceEur != null ? `€${l.priceEur.toLocaleString("de-DE")}` : "On request"}</strong>
          </div>
          {facts && <div className="facts">{facts}</div>}
          {summary && <p className="dialog-why">{summary}</p>}
        </div>

        <div className="dialog-body">
          {!!l.knowledge?.length && (
            <div>
              <span className="group-label">Your comments</span>
              <div className="comment-list">
                {l.knowledge.map((k) => (
                  <div key={k.id} className="comment">
                    <div>
                      {k.note}
                      {k.interesting && <span className="tag deal interesting">Interesting</span>}
                      {!k.thisAdOnly && <span className="tag">Similar machines</span>}
                    </div>
                    <button className="btn ghost" disabled={busy} onClick={() => void remove(k.id)}>
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <span className="group-label">Why is it interesting?</span>
            <div className="chips">
              {PICKS.map((p) => (
                <button
                  key={p}
                  className={`chip${picks.includes(p) ? " on" : ""}`}
                  aria-pressed={picks.includes(p)}
                  onClick={() => setPicks((cur) => (cur.includes(p) ? cur.filter((x) => x !== p) : [...cur, p]))}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          <label className="field-label">
            Note
            <textarea
              rows={2}
              maxLength={300}
              placeholder="Optional, e.g. call the seller about the hydraulics"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </label>

          <label className="check">
            <input type="checkbox" checked={interesting} onChange={(e) => setInteresting(e.target.checked)} />
            <span>
              <span className="check-title">Mark as interesting</span>
              <span className="sub">Untick to only save the comment.</span>
            </span>
          </label>

          <div className="watch">
            <label className="check">
              <input type="checkbox" checked={similar} onChange={(e) => setSimilar(e.target.checked)} />
              <span>
                <span className="check-title">Also apply to similar machines</span>
                <span className="sub">Otherwise it applies to this ad only.</span>
              </span>
            </label>
            {similar && (
              <>
                <div className="watch-grid">
                  <label className="field-label">
                    Name contains
                    <input value={contains} onChange={(e) => setContains(e.target.value)} />
                  </label>
                  <label className="field-label">
                    Up to €
                    <input inputMode="numeric" value={maxPrice} onChange={(e) => setMaxPrice(e.target.value.replace(/\D/g, ""))} />
                  </label>
                </div>
                <div className="sub">
                  {l.modelLabel}, {l.wheeled ? "Mobilbagger only" : "not Mobilbagger"} · matches <strong>{adsText(matching)}</strong>
                </div>
              </>
            )}
          </div>

          {error && <div className="comment-error">{error}</div>}
        </div>

        <div className="dialog-foot">
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn" disabled={busy || !canSave} onClick={() => void save()}>
            {busy ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
