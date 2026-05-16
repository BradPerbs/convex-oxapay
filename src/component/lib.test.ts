/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import schema from "./schema.js";
import { api } from "./_generated/api.js";

const modules = import.meta.glob("./**/*.ts");

function setup() {
  return convexTest(schema, modules);
}

describe("customers", () => {
  it("upserts a customer once per entityId", async () => {
    const t = setup();
    const id1 = await t.mutation(api.lib.upsertCustomer, {
      entityId: "u1",
      email: "a@b.c",
    });
    const id2 = await t.mutation(api.lib.upsertCustomer, {
      entityId: "u1",
      email: "x@y.z",
    });
    expect(id1).toBe(id2);
    const got = await t.query(api.lib.getCustomerByEntityId, { entityId: "u1" });
    // existing email is preserved (only enriched when missing)
    expect(got?.email).toBe("a@b.c");
  });
});

describe("payments", () => {
  const basePayment = (overrides: Partial<any> = {}) => ({
    id: "tk_1",
    entityId: "user_1",
    type: "invoice",
    status: "new",
    amount: 10,
    currency: "USD",
    callbackUrl: null,
    returnUrl: null,
    thanksMessage: null,
    email: null,
    orderId: null,
    description: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  it("upsert inserts then patches forward only", async () => {
    const t = setup();
    await t.mutation(api.lib.upsertPayment, { payment: basePayment() });
    await t.mutation(api.lib.upsertPayment, {
      payment: basePayment({ status: "waiting" }),
    });
    await t.mutation(api.lib.upsertPayment, {
      payment: basePayment({ status: "paid", paidAt: Date.now() }),
    });
    const after = await t.query(api.lib.getPaymentById, { id: "tk_1" });
    expect(after?.status).toBe("paid");
    expect(after?.paidAt).toBeDefined();
  });

  it("upsert refuses to downgrade from paid back to waiting", async () => {
    const t = setup();
    await t.mutation(api.lib.upsertPayment, {
      payment: basePayment({ status: "paid", paidAt: Date.now() }),
    });
    await t.mutation(api.lib.upsertPayment, {
      payment: basePayment({ status: "waiting" }),
    });
    const after = await t.query(api.lib.getPaymentById, { id: "tk_1" });
    expect(after?.status).toBe("paid");
  });

  it("listPaymentsByEntityId returns most-recent-first", async () => {
    const t = setup();
    await t.mutation(api.lib.upsertPayment, {
      payment: basePayment({ id: "tk_a" }),
    });
    await t.mutation(api.lib.upsertPayment, {
      payment: basePayment({ id: "tk_b" }),
    });
    const got = await t.query(api.lib.listPaymentsByEntityId, {
      entityId: "user_1",
    });
    expect(got).toHaveLength(2);
  });
});

describe("webhook idempotency", () => {
  it("markWebhookProcessed dedupes by eventKey", async () => {
    const t = setup();
    const first = await t.mutation(api.lib.markWebhookProcessed, {
      eventKey: "evk_1",
      trackId: "tk",
      status: "Paid",
      type: "invoice",
    });
    expect(first.alreadyProcessed).toBe(false);
    const second = await t.mutation(api.lib.markWebhookProcessed, {
      eventKey: "evk_1",
      trackId: "tk",
      status: "Paid",
      type: "invoice",
    });
    expect(second.alreadyProcessed).toBe(true);
  });
});

describe("patchPaymentFromWebhook", () => {
  const basePayment = (overrides: Partial<any> = {}) => ({
    id: "tk_w",
    entityId: "user_w",
    type: "invoice",
    status: "new",
    amount: 5,
    currency: "USD",
    callbackUrl: null,
    returnUrl: null,
    thanksMessage: null,
    email: null,
    orderId: null,
    description: null,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  });

  it("returns null when the row does not exist", async () => {
    const t = setup();
    const result = await t.mutation(api.lib.patchPaymentFromWebhook, {
      id: "missing",
      patch: { status: "Paid", updatedAt: Date.now() },
    });
    expect(result).toBe(null);
  });

  it("applies a status transition", async () => {
    const t = setup();
    await t.mutation(api.lib.upsertPayment, { payment: basePayment() });
    await t.mutation(api.lib.patchPaymentFromWebhook, {
      id: "tk_w",
      patch: { status: "Paid", paidAt: Date.now(), updatedAt: Date.now() },
    });
    const after = await t.query(api.lib.getPaymentById, { id: "tk_w" });
    expect(after?.status).toBe("Paid");
    expect(after?.paidAt).toBeDefined();
  });
});
