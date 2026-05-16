import { describe, expect, it } from "vitest";
import { hmacSha512Hex } from "./helpers.js";
import { verifyOxaPayWebhook, webhookAckResponse } from "./webhook.js";
import { WebhookVerificationError } from "./errors.js";

const MERCHANT = "MERCHANT-KEY-FOR-TESTING-SHA512";
const PAYOUT = "PAYOUT-KEY-FOR-TESTING-SHA512";

async function signedDelivery(body: string, secret: string) {
  const sig = await hmacSha512Hex(secret, body);
  return { body, headers: { HMAC: sig } };
}

describe("verifyOxaPayWebhook", () => {
  it("verifies a payment webhook against the merchant key", async () => {
    const body = JSON.stringify({
      track_id: "tk_123",
      status: "Paid",
      type: "invoice",
      amount: 10,
      currency: "USD",
      date: "2026-05-16T10:30:00Z",
    });
    const { headers } = await signedDelivery(body, MERCHANT);
    const result = await verifyOxaPayWebhook({
      rawBody: body,
      headers,
      merchantApiKey: MERCHANT,
      payoutApiKey: PAYOUT,
    });
    expect(result.keyUsed).toBe("merchant");
    expect(result.event.track_id).toBe("tk_123");
  });

  it("verifies a payout webhook against the payout key", async () => {
    const body = JSON.stringify({
      track_id: "pay_456",
      status: "Confirmed",
      type: "payout",
      address: "addr",
      amount: 1,
      currency: "BTC",
      network: "Bitcoin",
      date: "2026-05-16T11:00:00Z",
    });
    const { headers } = await signedDelivery(body, PAYOUT);
    const result = await verifyOxaPayWebhook({
      rawBody: body,
      headers,
      merchantApiKey: MERCHANT,
      payoutApiKey: PAYOUT,
    });
    expect(result.keyUsed).toBe("payout");
    expect(result.event.type).toBe("payout");
  });

  it("rejects when HMAC header is missing", async () => {
    const body = JSON.stringify({ track_id: "x", status: "Paid", type: "invoice" });
    await expect(
      verifyOxaPayWebhook({
        rawBody: body,
        headers: {},
        merchantApiKey: MERCHANT,
      }),
    ).rejects.toThrow(WebhookVerificationError);
  });

  it("rejects when the signature doesn't match", async () => {
    const body = JSON.stringify({ track_id: "x", status: "Paid", type: "invoice" });
    await expect(
      verifyOxaPayWebhook({
        rawBody: body,
        headers: { HMAC: "deadbeef".repeat(16) },
        merchantApiKey: MERCHANT,
      }),
    ).rejects.toThrow(/Invalid webhook signature/);
  });

  it("rejects when body is invalid JSON", async () => {
    await expect(
      verifyOxaPayWebhook({
        rawBody: "not json",
        headers: { HMAC: "x" },
        merchantApiKey: MERCHANT,
      }),
    ).rejects.toThrow(/Invalid JSON/);
  });

  it("rejects when the right secret is not provided", async () => {
    const body = JSON.stringify({ track_id: "x", status: "Confirmed", type: "payout", address: "a", amount: 1, currency: "BTC", network: "Bitcoin", date: 1 });
    const { headers } = await signedDelivery(body, PAYOUT);
    await expect(
      verifyOxaPayWebhook({
        rawBody: body,
        headers,
        merchantApiKey: MERCHANT,
        // no payout key
      }),
    ).rejects.toThrow(/payoutApiKey/);
  });

  it("uses case-insensitive header lookup", async () => {
    const body = JSON.stringify({ track_id: "tk", status: "Paid", type: "invoice" });
    const sig = await hmacSha512Hex(MERCHANT, body);
    const result = await verifyOxaPayWebhook({
      rawBody: body,
      headers: { hMaC: sig },
      merchantApiKey: MERCHANT,
    });
    expect(result.event.track_id).toBe("tk");
  });
});

describe("webhookAckResponse", () => {
  it('returns a 200 with body "ok"', async () => {
    const r = webhookAckResponse();
    expect(r.status).toBe(200);
    expect(await r.text()).toBe("ok");
  });
});
