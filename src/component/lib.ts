/**
 * Component lib — every query/mutation/internalAction the consumer's
 * client class calls via `ctx.runQuery/runMutation/runAction(this.component.lib.X, ...)`.
 *
 * Naming convention:
 *   - `get*` / `list*`  → queries (read-only)
 *   - `insert*` / `update*` / `delete*` → mutations
 *   - `*Action` / `sync*` → actions (HTTP I/O)
 *
 * API keys are passed as action arguments (never read from env inside the
 * component) — the client class owns env var resolution.
 */

import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { OxaPayClient } from "../client/http.js";
import type { OxaPayWebhookEvent } from "../client/types.js";
import { api } from "./_generated/api.js";
import { internalMutation, mutation, query, action } from "./_generated/server.js";
import schema, { txValidator } from "./schema.js";
import {
  buildEventKey,
  invoiceResponseToDoc,
  paymentRecordToDoc,
  paymentWebhookToPatch,
  payoutRecordToDoc,
  payoutWebhookToPatch,
  shouldApplyPaymentStatusTransition,
  staticAddressResponseToDoc,
  whiteLabelResponseToDoc,
  type PaymentDoc,
} from "./util.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const oxapayClientArgs = {
  merchantApiKey: v.optional(v.string()),
  payoutApiKey: v.optional(v.string()),
  generalApiKey: v.optional(v.string()),
  baseUrl: v.optional(v.string()),
};

function clientFromArgs(args: {
  merchantApiKey?: string;
  payoutApiKey?: string;
  generalApiKey?: string;
  baseUrl?: string;
}): OxaPayClient {
  return new OxaPayClient({
    merchantApiKey: args.merchantApiKey,
    payoutApiKey: args.payoutApiKey,
    generalApiKey: args.generalApiKey,
    baseUrl: args.baseUrl,
  });
}

export const omitSystemFields = <
  T extends { _id: string; _creationTime: number } | null | undefined,
>(
  doc: T,
) => {
  if (!doc) return doc;
  const { _id, _creationTime, ...rest } = doc;
  return rest;
};

// ---------------------------------------------------------------------------
// Customer queries / mutations
// ---------------------------------------------------------------------------

export const getCustomerByEntityId = query({
  args: { entityId: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("customers"),
      _creationTime: v.number(),
      ...schema.tables.customers.validator.fields,
    }),
  ),
  handler: async (ctx, args) => {
    const customer = await ctx.db
      .query("customers")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .unique();
    return customer ?? null;
  },
});

export const upsertCustomer = mutation({
  args: {
    entityId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    defaultNetwork: v.optional(v.string()),
    defaultCurrency: v.optional(v.string()),
    metadata: v.optional(v.record(v.string(), v.any())),
  },
  returns: v.id("customers"),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("customers")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .unique();
    const now = Date.now();
    if (existing) {
      const patch: Record<string, unknown> = { updatedAt: now };
      if (args.email !== undefined && !existing.email) patch.email = args.email;
      if (args.name !== undefined && !existing.name) patch.name = args.name;
      if (args.defaultNetwork !== undefined) patch.defaultNetwork = args.defaultNetwork;
      if (args.defaultCurrency !== undefined) patch.defaultCurrency = args.defaultCurrency;
      if (args.metadata !== undefined) {
        patch.metadata = { ...(existing.metadata ?? {}), ...args.metadata };
      }
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    return await ctx.db.insert("customers", {
      entityId: args.entityId,
      email: args.email,
      name: args.name,
      defaultNetwork: args.defaultNetwork,
      defaultCurrency: args.defaultCurrency,
      metadata: args.metadata,
      createdAt: now,
      updatedAt: now,
    });
  },
});

// ---------------------------------------------------------------------------
// Payment queries
// ---------------------------------------------------------------------------

const paymentDocValidator = v.object({
  _id: v.id("payments"),
  _creationTime: v.number(),
  ...schema.tables.payments.validator.fields,
});

export const getPaymentById = query({
  args: { id: v.string() },
  returns: v.union(v.null(), paymentDocValidator),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("payments")
      .withIndex("id", (q) => q.eq("id", args.id))
      .unique();
    return doc ?? null;
  },
});

export const listPaymentsByEntityId = query({
  args: {
    entityId: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(paymentDocValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 500);
    if (args.status) {
      return await ctx.db
        .query("payments")
        .withIndex("entityId_status", (q) =>
          q.eq("entityId", args.entityId).eq("status", args.status!),
        )
        .order("desc")
        .take(limit);
    }
    return await ctx.db
      .query("payments")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .order("desc")
      .take(limit);
  },
});

export const listPaymentsByStatus = query({
  args: { status: v.string(), limit: v.optional(v.number()) },
  returns: v.array(paymentDocValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 500);
    return await ctx.db
      .query("payments")
      .withIndex("status", (q) => q.eq("status", args.status))
      .order("desc")
      .take(limit);
  },
});

export const getPaymentByOrderId = query({
  args: { orderId: v.string() },
  returns: v.union(v.null(), paymentDocValidator),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("payments")
      .withIndex("orderId", (q) => q.eq("orderId", args.orderId))
      .first();
    return doc ?? null;
  },
});

// ---------------------------------------------------------------------------
// Payment write mutations
// ---------------------------------------------------------------------------

const paymentRowFieldsValidator = v.object({
  ...schema.tables.payments.validator.fields,
});

/**
 * Upsert a payment row. Used both by the create-payment helpers and the
 * webhook handler. Forward-only on `status` (won't downgrade `paid` → `paying`).
 */
export const upsertPayment = mutation({
  args: { payment: paymentRowFieldsValidator },
  returns: v.id("payments"),
  handler: async (ctx, args) => {
    const incoming = args.payment;
    const existing = await ctx.db
      .query("payments")
      .withIndex("id", (q) => q.eq("id", incoming.id))
      .unique();
    const now = Date.now();
    if (!existing) {
      return await ctx.db.insert("payments", {
        ...incoming,
        createdAt: incoming.createdAt ?? now,
        updatedAt: now,
      });
    }
    if (!shouldApplyPaymentStatusTransition(existing.status, incoming.status)) {
      // Skip — stale event. Bump updatedAt to make the skip visible without
      // changing semantics.
      await ctx.db.patch(existing._id, { updatedAt: now });
      return existing._id;
    }
    const patch: Partial<PaymentDoc> = {
      ...incoming,
      // Preserve fields that exist on the existing doc when the new payload
      // doesn't carry them (status webhooks often arrive with sparse fields).
      callbackUrl: incoming.callbackUrl ?? existing.callbackUrl,
      returnUrl: incoming.returnUrl ?? existing.returnUrl,
      thanksMessage: incoming.thanksMessage ?? existing.thanksMessage,
      email: incoming.email ?? existing.email,
      orderId: incoming.orderId ?? existing.orderId,
      description: incoming.description ?? existing.description,
      paymentUrl: incoming.paymentUrl ?? existing.paymentUrl,
      qrCode: incoming.qrCode ?? existing.qrCode,
      address: incoming.address ?? existing.address,
      memo: incoming.memo ?? existing.memo,
      network: incoming.network ?? existing.network,
      payAmount: incoming.payAmount ?? existing.payAmount,
      payCurrency: incoming.payCurrency ?? existing.payCurrency,
      rate: incoming.rate ?? existing.rate,
      entityId: incoming.entityId ?? existing.entityId,
      customerId: incoming.customerId ?? existing.customerId,
      metadata: { ...(existing.metadata ?? {}), ...(incoming.metadata ?? {}) },
      createdAt: existing.createdAt,
      updatedAt: now,
      paidAt: incoming.paidAt ?? existing.paidAt,
    };
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  },
});

/**
 * Patch a payment from a webhook delivery — narrower than upsertPayment.
 * Will fail gracefully if the row doesn't exist (returns null) so the
 * webhook handler can fall back to inserting via upsertPayment.
 */
export const patchPaymentFromWebhook = mutation({
  args: {
    id: v.string(),
    patch: v.object({
      status: v.string(),
      txs: v.optional(v.array(txValidator)),
      paidAt: v.optional(v.number()),
      updatedAt: v.number(),
      email: v.optional(v.union(v.string(), v.null())),
      orderId: v.optional(v.union(v.string(), v.null())),
      description: v.optional(v.union(v.string(), v.null())),
      callbackUrl: v.optional(v.union(v.string(), v.null())),
      amount: v.optional(v.number()),
      currency: v.optional(v.string()),
      type: v.optional(v.string()),
      entityId: v.optional(v.union(v.string(), v.null())),
    }),
  },
  returns: v.union(v.null(), v.id("payments")),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("payments")
      .withIndex("id", (q) => q.eq("id", args.id))
      .unique();
    if (!existing) return null;
    if (!shouldApplyPaymentStatusTransition(existing.status, args.patch.status)) {
      return existing._id;
    }
    const patch: Record<string, unknown> = {
      status: args.patch.status,
      updatedAt: args.patch.updatedAt,
    };
    if (args.patch.txs) patch.txs = args.patch.txs;
    if (args.patch.paidAt !== undefined && existing.paidAt === undefined) {
      patch.paidAt = args.patch.paidAt;
    }
    if (args.patch.email !== undefined && !existing.email) patch.email = args.patch.email;
    if (args.patch.orderId !== undefined && !existing.orderId) patch.orderId = args.patch.orderId;
    if (args.patch.description !== undefined && !existing.description) {
      patch.description = args.patch.description;
    }
    if (args.patch.callbackUrl !== undefined && !existing.callbackUrl) {
      patch.callbackUrl = args.patch.callbackUrl;
    }
    if (typeof args.patch.amount === "number" && !existing.amount) patch.amount = args.patch.amount;
    if (args.patch.currency && !existing.currency) patch.currency = args.patch.currency;
    if (args.patch.type && !existing.type) patch.type = args.patch.type;
    if (args.patch.entityId !== undefined && existing.entityId == null) {
      patch.entityId = args.patch.entityId;
    }
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  },
});

// ---------------------------------------------------------------------------
// Payout queries + mutations
// ---------------------------------------------------------------------------

const payoutDocValidator = v.object({
  _id: v.id("payouts"),
  _creationTime: v.number(),
  ...schema.tables.payouts.validator.fields,
});

const payoutRowFieldsValidator = v.object({
  ...schema.tables.payouts.validator.fields,
});

export const getPayoutById = query({
  args: { id: v.string() },
  returns: v.union(v.null(), payoutDocValidator),
  handler: async (ctx, args) => {
    const doc = await ctx.db
      .query("payouts")
      .withIndex("id", (q) => q.eq("id", args.id))
      .unique();
    return doc ?? null;
  },
});

export const listPayoutsByEntityId = query({
  args: {
    entityId: v.string(),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(payoutDocValidator),
  handler: async (ctx, args) => {
    const limit = Math.min(Math.max(args.limit ?? 50, 1), 500);
    if (args.status) {
      return await ctx.db
        .query("payouts")
        .withIndex("entityId_status", (q) =>
          q.eq("entityId", args.entityId).eq("status", args.status!),
        )
        .order("desc")
        .take(limit);
    }
    return await ctx.db
      .query("payouts")
      .withIndex("entityId", (q) => q.eq("entityId", args.entityId))
      .order("desc")
      .take(limit);
  },
});

export const upsertPayout = mutation({
  args: { payout: payoutRowFieldsValidator },
  returns: v.id("payouts"),
  handler: async (ctx, args) => {
    const incoming = args.payout;
    const existing = await ctx.db
      .query("payouts")
      .withIndex("id", (q) => q.eq("id", incoming.id))
      .unique();
    const now = Date.now();
    if (!existing) {
      return await ctx.db.insert("payouts", {
        ...incoming,
        createdAt: incoming.createdAt ?? now,
        updatedAt: now,
      });
    }
    const patch: Partial<typeof incoming> = {
      ...incoming,
      callbackUrl: incoming.callbackUrl ?? existing.callbackUrl,
      txHash: incoming.txHash ?? existing.txHash,
      network: incoming.network ?? existing.network,
      memo: incoming.memo ?? existing.memo,
      description: incoming.description ?? existing.description,
      entityId: incoming.entityId ?? existing.entityId,
      customerId: incoming.customerId ?? existing.customerId,
      metadata: { ...(existing.metadata ?? {}), ...(incoming.metadata ?? {}) },
      createdAt: existing.createdAt,
      updatedAt: now,
      confirmedAt: incoming.confirmedAt ?? existing.confirmedAt,
    };
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  },
});

export const patchPayoutFromWebhook = mutation({
  args: {
    id: v.string(),
    patch: v.object({
      status: v.string(),
      txHash: v.optional(v.union(v.string(), v.null())),
      amount: v.optional(v.number()),
      currency: v.optional(v.string()),
      network: v.optional(v.union(v.string(), v.null())),
      description: v.optional(v.union(v.string(), v.null())),
      callbackUrl: v.optional(v.union(v.string(), v.null())),
      updatedAt: v.number(),
      confirmedAt: v.optional(v.number()),
      entityId: v.optional(v.union(v.string(), v.null())),
    }),
  },
  returns: v.union(v.null(), v.id("payouts")),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("payouts")
      .withIndex("id", (q) => q.eq("id", args.id))
      .unique();
    if (!existing) return null;
    const patch: Record<string, unknown> = {
      status: args.patch.status,
      updatedAt: args.patch.updatedAt,
    };
    if (args.patch.txHash !== undefined && !existing.txHash) patch.txHash = args.patch.txHash;
    if (args.patch.network !== undefined && !existing.network) patch.network = args.patch.network;
    if (args.patch.description !== undefined && !existing.description) {
      patch.description = args.patch.description;
    }
    if (args.patch.callbackUrl !== undefined && !existing.callbackUrl) {
      patch.callbackUrl = args.patch.callbackUrl;
    }
    if (typeof args.patch.amount === "number" && !existing.amount) patch.amount = args.patch.amount;
    if (args.patch.currency && !existing.currency) patch.currency = args.patch.currency;
    if (args.patch.confirmedAt !== undefined && existing.confirmedAt === undefined) {
      patch.confirmedAt = args.patch.confirmedAt;
    }
    if (args.patch.entityId !== undefined && existing.entityId == null) {
      patch.entityId = args.patch.entityId;
    }
    await ctx.db.patch(existing._id, patch);
    return existing._id;
  },
});

// ---------------------------------------------------------------------------
// Webhook idempotency
// ---------------------------------------------------------------------------

export const markWebhookProcessed = mutation({
  args: {
    eventKey: v.string(),
    trackId: v.string(),
    status: v.string(),
    type: v.string(),
  },
  returns: v.object({ alreadyProcessed: v.boolean() }),
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("processedWebhooks")
      .withIndex("eventKey", (q) => q.eq("eventKey", args.eventKey))
      .first();
    if (existing) {
      return { alreadyProcessed: true };
    }
    await ctx.db.insert("processedWebhooks", {
      eventKey: args.eventKey,
      trackId: args.trackId,
      status: args.status,
      type: args.type,
      receivedAt: Date.now(),
    });
    return { alreadyProcessed: false };
  },
});

/** Garbage-collect old processed-webhook records. Retains 30 days. */
export const pruneProcessedWebhooks = internalMutation({
  args: { olderThanMs: v.optional(v.number()) },
  returns: v.object({ deleted: v.number() }),
  handler: async (ctx, args) => {
    const olderThan = args.olderThanMs ?? 30 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - olderThan;
    const stale = await ctx.db
      .query("processedWebhooks")
      .withIndex("receivedAt", (q) => q.lt("receivedAt", cutoff))
      .take(500);
    for (const doc of stale) {
      await ctx.db.delete(doc._id);
    }
    return { deleted: stale.length };
  },
});

// ---------------------------------------------------------------------------
// Actions — wrap OxaPay HTTP calls so the consumer doesn't need to make HTTP
// calls themselves. Each action takes the API keys as arguments.
// ---------------------------------------------------------------------------

export const createInvoiceAction = action({
  args: {
    ...oxapayClientArgs,
    entityId: v.union(v.string(), v.null()),
    metadata: v.optional(v.record(v.string(), v.any())),
    request: v.object({
      amount: v.number(),
      currency: v.optional(v.string()),
      lifetime: v.optional(v.number()),
      feePaidByPayer: v.optional(v.union(v.literal(0), v.literal(1))),
      underPaidCoverage: v.optional(v.number()),
      toCurrency: v.optional(v.string()),
      autoWithdrawal: v.optional(v.boolean()),
      mixedPayment: v.optional(v.boolean()),
      callbackUrl: v.optional(v.string()),
      returnUrl: v.optional(v.string()),
      email: v.optional(v.string()),
      orderId: v.optional(v.string()),
      thanksMessage: v.optional(v.string()),
      description: v.optional(v.string()),
      sandbox: v.optional(v.boolean()),
    }),
  },
  returns: v.object({
    trackId: v.string(),
    paymentUrl: v.string(),
    expiredAt: v.number(),
    date: v.number(),
  }),
  handler: async (ctx, args) => {
    const client = clientFromArgs(args);
    const resp = await client.createInvoice({
      amount: args.request.amount,
      currency: args.request.currency,
      lifetime: args.request.lifetime,
      fee_paid_by_payer: args.request.feePaidByPayer,
      under_paid_coverage: args.request.underPaidCoverage,
      to_currency: args.request.toCurrency,
      auto_withdrawal: args.request.autoWithdrawal ? 1 : undefined,
      mixed_payment: args.request.mixedPayment ? 1 : undefined,
      callback_url: args.request.callbackUrl,
      return_url: args.request.returnUrl,
      email: args.request.email,
      order_id: args.request.orderId,
      thanks_message: args.request.thanksMessage,
      description: args.request.description,
      sandbox: args.request.sandbox,
    });
    const doc = invoiceResponseToDoc(
      { entityId: args.entityId, metadata: args.metadata },
      {
        amount: args.request.amount,
        currency: args.request.currency ?? "USD",
        description: args.request.description,
        email: args.request.email,
        orderId: args.request.orderId,
      },
      resp,
    );
    await ctx.runMutation(api.lib.upsertPayment, {
      payment: { ...doc, createdAt: Date.now(), updatedAt: Date.now() },
    });
    return {
      trackId: resp.track_id,
      paymentUrl: resp.payment_url,
      expiredAt: resp.expired_at,
      date: resp.date,
    };
  },
});

export const createWhiteLabelAction = action({
  args: {
    ...oxapayClientArgs,
    entityId: v.union(v.string(), v.null()),
    metadata: v.optional(v.record(v.string(), v.any())),
    request: v.object({
      payCurrency: v.string(),
      amount: v.number(),
      currency: v.optional(v.string()),
      network: v.optional(v.string()),
      lifetime: v.optional(v.number()),
      feePaidByPayer: v.optional(v.union(v.literal(0), v.literal(1))),
      underPaidCoverage: v.optional(v.number()),
      callbackUrl: v.optional(v.string()),
      email: v.optional(v.string()),
      orderId: v.optional(v.string()),
      description: v.optional(v.string()),
    }),
  },
  returns: v.object({
    trackId: v.string(),
    address: v.string(),
    payAmount: v.number(),
    payCurrency: v.string(),
    network: v.string(),
    memo: v.string(),
    qrCode: v.string(),
    expiredAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const client = clientFromArgs(args);
    const resp = await client.createWhiteLabel({
      pay_currency: args.request.payCurrency,
      amount: args.request.amount,
      currency: args.request.currency,
      network: args.request.network,
      lifetime: args.request.lifetime,
      fee_paid_by_payer: args.request.feePaidByPayer,
      under_paid_coverage: args.request.underPaidCoverage,
      callback_url: args.request.callbackUrl,
      email: args.request.email,
      order_id: args.request.orderId,
      description: args.request.description,
    });
    const doc = whiteLabelResponseToDoc(
      { entityId: args.entityId, metadata: args.metadata },
      resp,
    );
    await ctx.runMutation(api.lib.upsertPayment, {
      payment: { ...doc, createdAt: Date.now(), updatedAt: Date.now() },
    });
    return {
      trackId: resp.track_id,
      address: resp.address,
      payAmount: resp.pay_amount,
      payCurrency: resp.pay_currency,
      network: resp.network,
      memo: resp.memo,
      qrCode: resp.qr_code,
      expiredAt: resp.expired_at,
    };
  },
});

export const createStaticAddressAction = action({
  args: {
    ...oxapayClientArgs,
    entityId: v.union(v.string(), v.null()),
    metadata: v.optional(v.record(v.string(), v.any())),
    request: v.object({
      network: v.string(),
      toCurrency: v.optional(v.string()),
      autoWithdrawal: v.optional(v.boolean()),
      callbackUrl: v.optional(v.string()),
      email: v.optional(v.string()),
      orderId: v.optional(v.string()),
      description: v.optional(v.string()),
    }),
  },
  returns: v.object({
    trackId: v.string(),
    address: v.string(),
    network: v.string(),
    memo: v.string(),
    qrCode: v.string(),
  }),
  handler: async (ctx, args) => {
    const client = clientFromArgs(args);
    const resp = await client.createStaticAddress({
      network: args.request.network,
      to_currency: args.request.toCurrency,
      auto_withdrawal: args.request.autoWithdrawal ? 1 : undefined,
      callback_url: args.request.callbackUrl,
      email: args.request.email,
      order_id: args.request.orderId,
      description: args.request.description,
    });
    const doc = staticAddressResponseToDoc(
      { entityId: args.entityId, metadata: args.metadata },
      resp,
      {
        network: args.request.network,
        toCurrency: args.request.toCurrency,
        callbackUrl: args.request.callbackUrl,
        description: args.request.description,
        email: args.request.email,
        orderId: args.request.orderId,
      },
    );
    await ctx.runMutation(api.lib.upsertPayment, {
      payment: { ...doc, createdAt: Date.now(), updatedAt: Date.now() },
    });
    return {
      trackId: resp.track_id,
      address: resp.address,
      network: resp.network,
      memo: resp.memo,
      qrCode: resp.qr_code,
    };
  },
});

export const revokeStaticAddressAction = action({
  args: {
    ...oxapayClientArgs,
    address: v.string(),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (_ctx, args) => {
    const client = clientFromArgs(args);
    await client.revokeStaticAddress({ address: args.address });
    return { ok: true };
  },
});

export const createPayoutAction = action({
  args: {
    ...oxapayClientArgs,
    entityId: v.union(v.string(), v.null()),
    metadata: v.optional(v.record(v.string(), v.any())),
    request: v.object({
      address: v.string(),
      currency: v.string(),
      amount: v.number(),
      network: v.optional(v.string()),
      callbackUrl: v.optional(v.string()),
      memo: v.optional(v.string()),
      description: v.optional(v.string()),
    }),
  },
  returns: v.object({ trackId: v.string(), status: v.string() }),
  handler: async (ctx, args) => {
    const client = clientFromArgs(args);
    const resp = await client.createPayout({
      address: args.request.address,
      currency: args.request.currency,
      amount: args.request.amount,
      network: args.request.network,
      callback_url: args.request.callbackUrl,
      memo: args.request.memo,
      description: args.request.description,
    });
    const now = Date.now();
    await ctx.runMutation(api.lib.upsertPayout, {
      payout: {
        id: resp.track_id,
        entityId: args.entityId,
        status: resp.status,
        address: args.request.address,
        currency: args.request.currency,
        network: args.request.network ?? null,
        amount: args.request.amount,
        fee: null,
        txHash: null,
        memo: args.request.memo ?? null,
        description: args.request.description ?? null,
        callbackUrl: args.request.callbackUrl ?? null,
        internal: undefined,
        metadata: args.metadata,
        providerCreatedAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    return { trackId: resp.track_id, status: resp.status };
  },
});

/** Fetch a payment from OxaPay and upsert it into the local mirror. */
export const refreshPaymentAction = action({
  args: { ...oxapayClientArgs, trackId: v.string() },
  returns: v.union(v.null(), paymentDocValidator),
  // Explicit return type breaks the type cycle (action -> runQuery -> api -> action).
  handler: async (ctx, args): Promise<any> => {
    const client = clientFromArgs(args);
    const record = await client.getPayment(args.trackId);
    const existing: any = await ctx.runQuery(api.lib.getPaymentById, {
      id: args.trackId,
    });
    const doc = paymentRecordToDoc(record, {
      entityId: existing?.entityId ?? null,
      metadata: existing?.metadata,
    });
    const now = Date.now();
    await ctx.runMutation(api.lib.upsertPayment, {
      payment: { ...doc, createdAt: existing?.createdAt ?? now, updatedAt: now },
    });
    return await ctx.runQuery(api.lib.getPaymentById, { id: args.trackId });
  },
});

/** Fetch a payout from OxaPay and upsert it into the local mirror. */
export const refreshPayoutAction = action({
  args: { ...oxapayClientArgs, trackId: v.string() },
  returns: v.union(v.null(), payoutDocValidator),
  handler: async (ctx, args): Promise<any> => {
    const client = clientFromArgs(args);
    const record = await client.getPayout(args.trackId);
    const existing: any = await ctx.runQuery(api.lib.getPayoutById, {
      id: args.trackId,
    });
    const doc = payoutRecordToDoc(record, {
      entityId: existing?.entityId ?? null,
      metadata: existing?.metadata,
    });
    const now = Date.now();
    await ctx.runMutation(api.lib.upsertPayout, {
      payout: { ...doc, createdAt: existing?.createdAt ?? now, updatedAt: now },
    });
    return await ctx.runQuery(api.lib.getPayoutById, { id: args.trackId });
  },
});

// ---------------------------------------------------------------------------
// Webhook ingest action — called by the http route after signature verify.
// Returns whether the event was newly processed (false = duplicate).
// ---------------------------------------------------------------------------

export const ingestWebhookAction = action({
  args: {
    event: v.any(),
    keyUsed: v.union(v.literal("merchant"), v.literal("payout")),
  },
  returns: v.object({
    alreadyProcessed: v.boolean(),
    trackId: v.string(),
    status: v.string(),
    type: v.string(),
  }),
  handler: async (ctx, args) => {
    const event = args.event as OxaPayWebhookEvent;
    if (!event || typeof event !== "object") {
      throw new ConvexError("Webhook event must be an object");
    }
    const eventKey = await buildEventKey(event);
    const { alreadyProcessed } = await ctx.runMutation(
      api.lib.markWebhookProcessed,
      {
        eventKey,
        trackId: String(event.track_id ?? ""),
        status: String(event.status ?? ""),
        type: String(event.type ?? ""),
      },
    );
    if (alreadyProcessed) {
      return {
        alreadyProcessed: true,
        trackId: String(event.track_id ?? ""),
        status: String(event.status ?? ""),
        type: String(event.type ?? ""),
      };
    }

    if (event.type === "payout") {
      const patch = payoutWebhookToPatch(event);
      const updatedId = await ctx.runMutation(
        api.lib.patchPayoutFromWebhook,
        { id: String(event.track_id), patch },
      );
      if (!updatedId) {
        // Row missing — insert from webhook data (best-effort).
        await ctx.runMutation(api.lib.upsertPayout, {
          payout: {
            id: String(event.track_id),
            entityId: null,
            status: patch.status,
            address: typeof event.address === "string" ? event.address : "",
            currency: patch.currency ?? "",
            network: patch.network ?? null,
            amount: patch.amount ?? 0,
            fee: null,
            txHash: patch.txHash ?? null,
            memo: typeof event.memo === "string" ? event.memo : null,
            description: patch.description ?? null,
            callbackUrl: patch.callbackUrl ?? null,
            internal: undefined,
            metadata: undefined,
            providerCreatedAt: undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            confirmedAt: patch.confirmedAt,
          },
        });
      }
    } else {
      const patch = paymentWebhookToPatch(event);
      const updatedId = await ctx.runMutation(
        api.lib.patchPaymentFromWebhook,
        { id: String(event.track_id), patch },
      );
      if (!updatedId) {
        // Row missing — insert from webhook data (best-effort fields only).
        await ctx.runMutation(api.lib.upsertPayment, {
          payment: {
            id: String(event.track_id),
            entityId: null,
            type: patch.type ?? "invoice",
            status: patch.status,
            amount: patch.amount ?? 0,
            currency: patch.currency ?? "",
            payAmount: undefined,
            payCurrency: undefined,
            network: undefined,
            address: undefined,
            memo: undefined,
            paymentUrl: undefined,
            qrCode: undefined,
            rate: undefined,
            mixedPayment: undefined,
            feePaidByPayer: undefined,
            underPaidCoverage: undefined,
            lifetime: undefined,
            autoWithdrawal: undefined,
            toCurrency: undefined,
            callbackUrl: patch.callbackUrl ?? null,
            returnUrl: null,
            thanksMessage: null,
            email: patch.email ?? null,
            orderId: patch.orderId ?? null,
            description: patch.description ?? null,
            metadata: undefined,
            txs: patch.txs,
            providerCreatedAt: undefined,
            providerExpiredAt: undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            paidAt: patch.paidAt,
          },
        });
      }
    }

    return {
      alreadyProcessed: false,
      trackId: String(event.track_id ?? ""),
      status: String(event.status ?? ""),
      type: String(event.type ?? ""),
    };
  },
});
