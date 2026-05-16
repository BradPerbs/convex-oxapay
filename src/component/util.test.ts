import { describe, expect, it } from "vitest";
import {
  buildEventKey,
  coerceTimestampMs,
  invoiceResponseToDoc,
  isPayoutSuccessStatus,
  isSuccessStatus,
  paymentRecordToDoc,
  paymentWebhookToPatch,
  payoutWebhookToPatch,
  shouldApplyPaymentStatusTransition,
  staticAddressResponseToDoc,
  toBool,
  toNumber,
  whiteLabelResponseToDoc,
} from "./util.js";

describe("status helpers", () => {
  it("isSuccessStatus is case-insensitive for paid/manual_accept", () => {
    expect(isSuccessStatus("paid")).toBe(true);
    expect(isSuccessStatus("Paid")).toBe(true);
    expect(isSuccessStatus("manual_accept")).toBe(true);
    expect(isSuccessStatus("waiting")).toBe(false);
    expect(isSuccessStatus(undefined)).toBe(false);
  });

  it("isPayoutSuccessStatus accepts only confirmed", () => {
    expect(isPayoutSuccessStatus("confirmed")).toBe(true);
    expect(isPayoutSuccessStatus("Confirmed")).toBe(true);
    expect(isPayoutSuccessStatus("confirming")).toBe(false);
  });
});

describe("coerceTimestampMs", () => {
  it("converts Unix seconds (number) to ms", () => {
    expect(coerceTimestampMs(1700000000)).toBe(1700000000_000);
  });
  it("passes through ms epoch", () => {
    expect(coerceTimestampMs(1700000000_000)).toBe(1700000000_000);
  });
  it("parses ISO strings", () => {
    expect(coerceTimestampMs("2026-05-16T00:00:00Z")).toBe(Date.parse("2026-05-16T00:00:00Z"));
  });
  it("returns undefined for null", () => {
    expect(coerceTimestampMs(null)).toBeUndefined();
  });
});

describe("toNumber / toBool", () => {
  it("toNumber handles strings and ints", () => {
    expect(toNumber("3.14")).toBe(3.14);
    expect(toNumber(42)).toBe(42);
    expect(toNumber("nope")).toBeUndefined();
  });
  it("toBool handles 0/1 and 'true'/'false'", () => {
    expect(toBool(1)).toBe(true);
    expect(toBool(0)).toBe(false);
    expect(toBool("true")).toBe(true);
    expect(toBool("false")).toBe(false);
    expect(toBool(undefined)).toBeUndefined();
  });
});

describe("shouldApplyPaymentStatusTransition", () => {
  it("allows progression from new → waiting → paid", () => {
    expect(shouldApplyPaymentStatusTransition("new", "waiting")).toBe(true);
    expect(shouldApplyPaymentStatusTransition("waiting", "paid")).toBe(true);
  });
  it("blocks downgrades from paid", () => {
    expect(shouldApplyPaymentStatusTransition("paid", "paying")).toBe(false);
    expect(shouldApplyPaymentStatusTransition("paid", "waiting")).toBe(false);
  });
  it("allows refunding after paid", () => {
    expect(shouldApplyPaymentStatusTransition("paid", "refunded")).toBe(true);
    expect(shouldApplyPaymentStatusTransition("paid", "refunding")).toBe(true);
  });
  it("blocks resurrecting expired payments", () => {
    expect(shouldApplyPaymentStatusTransition("expired", "paid")).toBe(false);
  });
  it("allows same-status (tx list update)", () => {
    expect(shouldApplyPaymentStatusTransition("paying", "paying")).toBe(true);
  });
  it("allows first write when no existing status", () => {
    expect(shouldApplyPaymentStatusTransition(undefined, "waiting")).toBe(true);
  });
});

describe("invoiceResponseToDoc", () => {
  it("builds a payment row from create-invoice response", () => {
    const doc = invoiceResponseToDoc(
      { entityId: "user_1", metadata: { plan: "premium" } },
      { amount: 10, currency: "USD", description: "Premium", email: "a@b.c", orderId: "ord_1" },
      { track_id: "tk_1", payment_url: "https://pay/x", expired_at: 1700000000, date: 1700000000 - 60 },
    );
    expect(doc.id).toBe("tk_1");
    expect(doc.entityId).toBe("user_1");
    expect(doc.type).toBe("invoice");
    expect(doc.status).toBe("new");
    expect(doc.amount).toBe(10);
    expect(doc.currency).toBe("USD");
    expect(doc.paymentUrl).toBe("https://pay/x");
    expect(doc.metadata).toEqual({ plan: "premium" });
  });
});

describe("whiteLabelResponseToDoc + staticAddressResponseToDoc", () => {
  it("builds white-label doc", () => {
    const doc = whiteLabelResponseToDoc(
      { entityId: null },
      {
        track_id: "tk",
        amount: 5,
        currency: "USD",
        pay_amount: 0.0001,
        pay_currency: "BTC",
        network: "Bitcoin",
        address: "1xx",
        memo: "",
        rate: 50000,
        qr_code: "qr",
        expired_at: 0,
        date: 0,
      },
    );
    expect(doc.type).toBe("white_label");
    expect(doc.address).toBe("1xx");
    expect(doc.payCurrency).toBe("BTC");
  });

  it("builds static-address doc", () => {
    const doc = staticAddressResponseToDoc(
      { entityId: "user" },
      { track_id: "tk", network: "Bitcoin", address: "1xx", memo: "", qr_code: "qr", date: 0 },
      { network: "Bitcoin", toCurrency: "USD", callbackUrl: "u" },
    );
    expect(doc.type).toBe("static_address");
    expect(doc.toCurrency).toBe("USD");
    expect(doc.callbackUrl).toBe("u");
  });
});

describe("paymentRecordToDoc", () => {
  it("translates a REST payment record", () => {
    const doc = paymentRecordToDoc({
      track_id: "tk",
      type: "invoice",
      amount: 25,
      currency: "USD",
      status: "paid",
      date: 1700000000,
      txs: [{ tx_hash: "0x", amount: 25, currency: "USD", network: "Bitcoin", address: "1a", status: "confirmed", date: 1700000060 }],
    });
    expect(doc.status).toBe("paid");
    expect(doc.txs?.[0].txHash).toBe("0x");
    expect(doc.paidAt).toBeDefined();
  });
});

describe("paymentWebhookToPatch", () => {
  it("maps a payment webhook payload to a patch with paidAt when status is paid", () => {
    const patch = paymentWebhookToPatch({
      track_id: "tk",
      status: "Paid",
      type: "invoice",
      amount: "10",
      currency: "USD",
      date: "2026-05-16T10:30:00Z",
    } as any);
    expect(patch.status).toBe("Paid");
    expect(patch.amount).toBe(10);
    expect(patch.paidAt).toBeDefined();
  });
  it("does not set paidAt for non-success statuses", () => {
    const patch = paymentWebhookToPatch({
      track_id: "tk",
      status: "Paying",
      type: "invoice",
      amount: 10,
      currency: "USD",
      date: 0,
    } as any);
    expect(patch.paidAt).toBeUndefined();
  });
});

describe("payoutWebhookToPatch", () => {
  it("sets confirmedAt for Confirmed status", () => {
    const patch = payoutWebhookToPatch({
      track_id: "p",
      status: "Confirmed",
      type: "payout",
      address: "a",
      amount: 1,
      currency: "BTC",
      network: "Bitcoin",
      tx_hash: "0xabc",
      date: 0,
    } as any);
    expect(patch.status).toBe("Confirmed");
    expect(patch.txHash).toBe("0xabc");
    expect(patch.confirmedAt).toBeDefined();
  });
});

describe("buildEventKey", () => {
  it("is stable across calls for the same event", async () => {
    const event = {
      track_id: "tk",
      status: "Paid",
      type: "invoice",
      amount: 10,
      currency: "USD",
      date: 0,
      txs: [{ tx_hash: "0xhash", amount: 10, currency: "USD", network: "Bitcoin", address: "a", status: "confirmed", date: 0 }],
    } as any;
    const a = await buildEventKey(event);
    const b = await buildEventKey(event);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{32}$/);
  });
  it("differs across statuses", async () => {
    const a = await buildEventKey({ track_id: "tk", status: "Paying", type: "invoice" } as any);
    const b = await buildEventKey({ track_id: "tk", status: "Paid", type: "invoice" } as any);
    expect(a).not.toBe(b);
  });
});
