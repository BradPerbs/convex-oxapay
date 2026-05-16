/**
 * Wire up the OxaPay component. The single instance is exported and reused
 * everywhere: actions, queries, mutations, and http.ts all import from here.
 *
 * For this demo we skip auth entirely and let the frontend pass an email
 * as the entityId on every call. In a real app you'd resolve `entityId`
 * from `ctx.auth.getUserIdentity()` (see the README for that pattern).
 */

import { OxaPay } from "convex-oxapay";
import { components } from "./_generated/api.js";

export const oxapay = new OxaPay(components.oxapay, {
  // Keys default to env vars (OXAPAY_MERCHANT_API_KEY / OXAPAY_PAYOUT_API_KEY).
  // Set them with `npx convex env set OXAPAY_MERCHANT_API_KEY ...`.
});
