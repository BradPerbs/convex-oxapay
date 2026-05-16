/**
 * Crypto + HTTP helpers used by the OxaPay HTTP client and webhook verifier.
 *
 * Pure functions — no Convex or Node-only dependencies. Safe to import from
 * either the browser, edge runtimes, or Convex's V8-isolated runtime.
 */

/** Convert a Uint8Array to a lowercase hex string. */
export function toHex(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 1) {
    out += bytes[i].toString(16).padStart(2, "0");
  }
  return out;
}

/** Convert a lowercase/uppercase hex string to a Uint8Array. Strict — throws on bad input. */
export function fromHex(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have an even length");
  }
  const out = new Uint8Array(hex.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    const byte = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error("Invalid hex character");
    }
    out[i] = byte;
  }
  return out;
}

/** Constant-time equality check for two strings (lengths compared too). */
export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i += 1) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/** Normalize a signature header value: trim whitespace, strip optional `sha512=` prefix, lowercase. */
export function normalizeSignature(sig: string): string {
  const trimmed = sig.trim();
  const eqIdx = trimmed.indexOf("=");
  // Only strip prefix if it matches a known algorithm token followed by `=`
  if (eqIdx > 0 && /^[a-zA-Z0-9-_]+=/.test(trimmed)) {
    return trimmed.slice(eqIdx + 1).toLowerCase();
  }
  return trimmed.toLowerCase();
}

/** Lowercase all header keys for case-insensitive lookup. */
export function lowerCaseHeaders(headers: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(headers)) {
    out[key.toLowerCase()] = headers[key];
  }
  return out;
}

/**
 * Compute HMAC-SHA512 of a payload string using a secret string, returning
 * the digest as a lowercase hex string. Uses Web Crypto, available in
 * Convex's runtime, browsers, and modern Node.
 */
export async function hmacSha512Hex(secret: string, payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return toHex(new Uint8Array(sig));
}

/**
 * Drop entries with `undefined` or `null` values from an object. OxaPay rejects
 * payloads with nulls in unexpected fields, so callers strip them before sending.
 */
export function stripUndefined<T extends object>(obj: T): Partial<T> {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj)) {
    const v = (obj as Record<string, unknown>)[key];
    if (v !== undefined && v !== null) {
      out[key] = v;
    }
  }
  return out as Partial<T>;
}

/** Build a URL with query parameters, omitting undefined/null values. */
export function buildUrl(base: string, path: string, query?: object): string {
  const trimmedBase = base.endsWith("/") ? base.slice(0, -1) : base;
  const trimmedPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${trimmedBase}${trimmedPath}`;
  if (!query) return url;
  const params: string[] = [];
  for (const key of Object.keys(query)) {
    const v = (query as Record<string, unknown>)[key];
    if (v === undefined || v === null) continue;
    params.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return params.length === 0 ? url : `${url}?${params.join("&")}`;
}
