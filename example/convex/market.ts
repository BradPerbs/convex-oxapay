import { action } from "./_generated/server.js";
import { v } from "convex/values";
import { oxapay } from "./oxapay.js";

export const prices = action({
  args: {},
  returns: v.any(),
  handler: async () => oxapay.common.prices(),
});

export const monitor = action({
  args: {},
  returns: v.any(),
  handler: async () => oxapay.common.monitor(),
});

export const balance = action({
  args: {},
  returns: v.any(),
  handler: async () => oxapay.account.balance(),
});
