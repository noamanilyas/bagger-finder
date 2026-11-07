"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";

type Props = {
  /** the limits the scrape will use, e.g. "Max price: €30.000" */
  details: string[];
  onConfirm: () => void;
  onClose: () => void;
};

/** Asks before "Refresh now" starts a scrape, because a scrape takes minutes and cannot be stopped from the page. */
export default function ConfirmScrape({ details, onConfirm, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return createPortal(
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog confirm" role="dialog" aria-modal="true" aria-labelledby="confirm-scrape-title" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-head">
          <h2 id="confirm-scrape-title">Start a scrape now?</h2>
        </div>
        <div className="dialog-body">
          <p className="confirm-text">This searches all sources again and can take a few minutes.</p>
          <ul className="confirm-details">
            {details.map((d) => (
              <li key={d}>{d}</li>
            ))}
          </ul>
        </div>
        <div className="dialog-foot">
          {/* focus starts on Cancel so a repeated Enter on "Refresh now" cannot start a scrape */}
          <button className="btn ghost" autoFocus onClick={onClose}>
            Cancel
          </button>
          <button className="btn" onClick={onConfirm}>
            Start scrape
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
