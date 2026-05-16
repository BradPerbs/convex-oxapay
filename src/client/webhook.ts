/**
 * OxaPay webhook signature verification.
 *
 * Spec (from https://docs.oxapay.com/webhook):
 *   - The signature is sent in the `HMAC` header (uppercase, no algorithm prefix).
 *   - It is computed as `HMAC-SHA512(secret, raw_body_bytes)` returned as
 *     lowercase hex.
 *   - The secret used depends on the event type:
 *       - `type: "payout"` → payout API key
 *       - all other types  → merchant API key
 *   - Receiver MUST respond with HTTP 200 and body `"ok"` exactly; anything
 *     else triggers up to 5 retries with backoff.
 *
 * Always verify against the RAW body bytes as received — re-serializing parsed
 * JSON will produce a different byte sequence and break verification.
 */

import { WebhookVerificationError } from "./errors.js";
import {
  constantTimeEqual,
  hmacSha512Hex,
  lowerCaseHeaders,
  normalizeSignature,
} from "./helpers.js";
import type { OxaPayWebhookEvent } from "./types.js";
import { isPayoutWebhook } from "./types.js";

export interface VerifyWebhookArgs {
  /** Raw request body string (e.g. `await request.text()`). */
  rawBody: string;
  /** Request headers (case-insensitive lookup is handled internally). */
  headers: Record<string, string>;
  /** Merchant API key — used for non-payout events. */
  merchantApiKey?: string;
  /** Payout API key — used when the event has `type: "payout"`. */
  payoutApiKey?: string;
}

export interface VerifiedWebhook {
  event: OxaPayWebhookEvent;
  /** Which key was used to verify (handy for logging). */
  keyUsed: "merchant" | "payout";
}

/**
 * Parse the body, look up the appropriate secret based on event type, and
 * verify the HMAC-SHA512 signature in constant time. Throws
 * `WebhookVerificationError` on failure.
 */
export async function verifyOxaPayWebhook(args: VerifyWebhookArgs): Promise<VerifiedWebhook> {
  const headers = lowerCaseHeaders(args.headers);
  const signature = headers["hmac"];
  if (!signature) {
    throw new WebhookVerificationError("Missing 'HMAC' header");
  }

  let parsed: OxaPayWebhookEvent;
  try {
    parsed = JSON.parse(args.rawBody) as OxaPayWebhookEvent;
  } catch (err) {
    throw new WebhookVerificationError(
      `Invalid JSON in webhook body: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  if (!parsed || typeof parsed !== "object") {
    throw new WebhookVerificationError("Webhook body did not parse to an object");
  }
  if (typeof parsed.type !== "string") {
    throw new WebhookVerificationError("Webhook body missing required 'type' field");
  }

  const usePayout = isPayoutWebhook(parsed);
  const secret = usePayout ? args.payoutApiKey : args.merchantApiKey;
  if (!secret) {
    throw new WebhookVerificationError(
      `Cannot verify webhook with type='${parsed.type}': ${usePayout ? "payoutApiKey" : "merchantApiKey"} is not configured`,
    );
  }

  const expected = await hmacSha512Hex(secret, args.rawBody);
  const provided = normalizeSignature(signature);
  if (!constantTimeEqual(expected, provided)) {
    throw new WebhookVerificationError("Invalid webhook signature");
  }

  return { event: parsed, keyUsed: usePayout ? "payout" : "merchant" };
}

/**
 * Produce the success response OxaPay expects (HTTP 200, body `"ok"`,
 * `Content-Type: text/plain`). Anything else triggers retries.
 */
export function webhookAckResponse(): Response {
  return new Response("ok", {
    status: 200,
    headers: { "Content-Type": "text/plain" },
  });
}
