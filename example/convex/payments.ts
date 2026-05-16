/**
 * Hosted invoice + white-label payment helpers.
 *
 * The frontend passes `email` as the entityId on every call. Real apps would
 * resolve this from `ctx.auth.getUserIdentity()` (see README).
 */

import { v } from "convex/values";
import { action, query } from "./_generated/server.js";
import { oxapay } from "./oxapay.js";

/**
 * Create a hosted invoice. OxaPay renders its own checkout UI at
 * `pay.oxapay.com/...`. Returns the URL to redirect / popup the user to.
 */
export const createInvoice = action({
  args: {
    email: v.string(),
    amount: v.number(),
    currency: v.optional(v.string()),
    description: v.optional(v.string()),
    lifetime: v.optional(v.number()),
    toCurrency: v.optional(v.string()),
  },
  returns: v.object({
    trackId: v.string(),
    paymentUrl: v.string(),
    expiredAt: v.number(),
    date: v.number(),
  }),
  handler: async (ctx, args) => {
    return await oxapay.payments.createInvoice(ctx, {
      entityId: args.email,
      amount: args.amount,
      currency: args.currency ?? "USD",
      description: args.description ?? "Demo payment",
      orderId: args.email,
      lifetime: args.lifetime ?? 60,
      toCurrency: args.toCurrency,
    });
  },
});

/** Back-compat alias from the simpler demo. */
export const createUsdInvoice = action({
  args: { email: v.string(), amount: v.number() },
  returns: v.object({
    trackId: v.string(),
    paymentUrl: v.string(),
    expiredAt: v.number(),
    date: v.number(),
  }),
  handler: async (ctx, args) => {
    return await oxapay.payments.createInvoice(ctx, {
      entityId: args.email,
      amount: args.amount,
      currency: "USD",
      description: "Upgrade to premium",
      orderId: args.email,
      lifetime: 60,
    });
  },
});

/**
 * Create a white-label payment. You render the UI yourself with the returned
 * address, payAmount, and QR code. No redirect to oxapay.com.
 */
export const createWhiteLabel = action({
  args: {
    email: v.string(),
    payCurrency: v.string(),
    amount: v.number(),
    currency: v.optional(v.string()),
    network: v.optional(v.string()),
    description: v.optional(v.string()),
    lifetime: v.optional(v.number()),
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
    return await oxapay.payments.createWhiteLabel(ctx, {
      entityId: args.email,
      payCurrency: args.payCurrency,
      amount: args.amount,
      currency: args.currency ?? "USD",
      network: args.network,
      description: args.description ?? "White-label payment",
      orderId: args.email,
      lifetime: args.lifetime ?? 60,
    });
  },
});

export const getPayment = query({
  args: { trackId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await oxapay.payments.get(ctx, { trackId: args.trackId });
  },
});

export const refreshPayment = action({
  args: { trackId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await oxapay.payments.refresh(ctx, { trackId: args.trackId });
  },
});

export const listMine = query({
  args: {
    email: v.string(),
    type: v.optional(v.string()),
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    if (!args.email) return [];
    const all = await oxapay.payments.listForEntity(ctx, {
      entityId: args.email,
      status: args.status,
      limit: args.limit ?? 50,
    });
    if (args.type) return all.filter((p: any) => p.type === args.type);
    return all;
  },
});
