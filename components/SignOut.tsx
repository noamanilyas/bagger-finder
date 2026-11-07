"use client";

import { useEffect, useState } from "react";

/** Sign-out button for the header, naming the signed-in address. Hidden when sign-in is off for local use. */
export default function SignOut() {
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/me", { cache: "no-store" })
      .then(async (res) => {
        if (res.ok) setEmail(((await res.json()) as { email: string | null }).email);
      })
      .catch(() => {}); // the rest of the page says when the server cannot be reached
  }, []);

  if (!email) return null;
  return (
    <form method="post" action="/sign-out" className="sign-out">
      <button className="btn secondary icon" type="submit" aria-label={`Sign out ${email}`} title={`Sign out ${email}`}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
          <path d="M16 17l5-5-5-5" />
          <path d="M21 12H9" />
        </svg>
      </button>
    </form>
  );
}
