import crypto from "node:crypto";

/**
 * The external system has no sign-in session, so the ingest paths skip the middleware and check INGEST_API_KEY,
 * sent as "Authorization: Bearer <key>" or "X-API-Key: <key>". Null when allowed, else the reason and status.
 */
export function checkIngestKey(headers: Headers): { status: number; error: string } | null {
  const expected = process.env.INGEST_API_KEY;
  if (!expected) return { status: 503, error: "The ingest API is not configured (INGEST_API_KEY)" };
  if (expected.length < 16) return { status: 503, error: "INGEST_API_KEY must be at least 16 characters" };
  const given = headers.get("x-api-key") ?? headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const hash = (s: string) => crypto.createHash("sha256").update(s).digest();
  return crypto.timingSafeEqual(hash(given), hash(expected)) ? null : { status: 401, error: "Missing or wrong API key" };
}
