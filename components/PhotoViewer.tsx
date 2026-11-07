"use client";

import { useEffect, useRef, useState } from "react";
import { largePhoto } from "@/lib/photos";
import type { Listing } from "@/lib/types";

type Props = {
  /** a listing that has a photo */
  listing: Listing & { imageUrl: string };
  onClose: () => void;
};

/** A machine's photo, filling the screen. Closes with Esc, the X, or a click beside the photo. */
export default function PhotoViewer({ listing, onClose }: Props) {
  // The small photo is already loaded, so it shows at once; the big one replaces it only if it loads.
  const [src, setSrc] = useState(listing.imageUrl);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const big = new Image();
    big.referrerPolicy = "no-referrer";
    big.onload = () => setSrc(big.src);
    big.src = largePhoto(listing.imageUrl);
    return () => {
      big.onload = null;
    };
  }, [listing.imageUrl]);

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      before?.focus?.();
    };
  }, [onClose]);

  return (
    <div className="viewer" role="dialog" aria-modal="true" aria-label={`Photo of ${listing.title}`} onClick={onClose}>
      <button ref={closeButton} className="viewer-close" aria-label="Close photo">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={listing.title} referrerPolicy="no-referrer" onClick={(e) => e.stopPropagation()} />
      <a href={listing.url} target="_blank" rel="noopener noreferrer" className="viewer-caption" onClick={(e) => e.stopPropagation()}>
        {listing.title}
      </a>
    </div>
  );
}
