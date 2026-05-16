/**
 * Payout (withdrawal) helpers.
 *
 * Payouts are REAL on-chain transactions. There is no payout sandbox.
 * The demo includes the API but you should test with tiny amounts on a
 * cheap chain (e.g. POL on Polygon) until you trust the integration.
 */

import { v } from "convex/values";
import { action, query } from "./_generated/server.js";
import { oxapay } from "./oxapay.js";

export const create = action({
  args: {
    email: v.string(),
    address: v.string(),
    currency: v.string(),
    amount: v.number(),
    network: v.optional(v.string()),
    description: v.optional(v.string()),
    memo: v.optional(v.string()),
  },
  returns: v.object({ trackId: v.string(), status: v.string() }),
  handler: async (ctx, args) => {
    return await oxapay.payouts.create(ctx, {
      entityId: args.email,
      address: args.address,
      currency: args.currency,
      network: args.network,
      amount: args.amount,
      description: args.description,
      memo: args.memo,
    });
  },
});

export const get = query({
  args: { trackId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await oxapay.payouts.get(ctx, { trackId: args.trackId });
  },
});

export const listMine = query({
  args: { email: v.string(), limit: v.optional(v.number()) },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    if (!args.email) return [];
    return await oxapay.payouts.listForEntity(ctx, {
      entityId: args.email,
      limit: args.limit,
    });
  },
});

export const refresh = action({
  args: { trackId: v.string() },
  returns: v.any(),
  handler: async (ctx, args) => {
    return await oxapay.payouts.refresh(ctx, { trackId: args.trackId });
  },
});
