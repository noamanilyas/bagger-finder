/** Who may use the site once signed in. Used by middleware.ts, so it must stay free of Node-only imports. */

/** Parses ALLOWED_EMAILS, a comma-separated list. */
export function parseAllowedEmails(value: string | undefined): Set<string> {
  return new Set(
    (value ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

/** Anyone can register with WorkOS, so only a verified address on the list gets in. An empty list lets nobody in. */
export function isAllowedUser(user: { email: string; emailVerified: boolean }, allowed: Set<string>): boolean {
  return user.emailVerified && allowed.has(user.email.trim().toLowerCase());
}
