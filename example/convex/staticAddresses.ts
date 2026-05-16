/**
 * Static (permanent) deposit address management.
 *
 * Each user can have one address per (network, toCurrency) combo. The demo
 * keeps things simple and lets the user create as many as they want.
 */

import { v } from "convex/values";
import { action, query } from "./_generated/server.js";
import { oxapay } from "./oxapay.js";

export const create = action({
  args: {
    email: v.string(),
    network: v.string(),
    toCurrency: v.optional(v.string()),
    autoWithdrawal: v.optional(v.boolean()),
  },
  returns: v.object({
    trackId: v.string(),
    address: v.string(),
    network: v.string(),
    memo: v.string(),
    qrCode: v.string(),
  }),
  handler: async (ctx, args) => {
    return await oxapay.staticAddresses.create(ctx, {
      entityId: args.email,
      network: args.network,
      toCurrency: args.toCurrency,
      autoWithdrawal: args.autoWithdrawal,
      orderId: args.email,
      description: `Demo wallet for ${args.email}`,
    });
  },
});

/** List the static-address payment rows for the given email. */
export const listMine = query({
  args: { email: v.string() },
  returns: v.array(v.any()),
  handler: async (ctx, args) => {
    if (!args.email) return [];
    const all = await oxapay.payments.listForEntity(ctx, {
      entityId: args.email,
      limit: 50,
    });
    return all.filter((p: any) => p.type === "static_address");
  },
});
