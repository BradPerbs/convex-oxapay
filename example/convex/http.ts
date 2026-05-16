import { httpRouter } from "convex/server";
import { internal } from "./_generated/api.js";
import { oxapay } from "./oxapay.js";

const http = httpRouter();

/**
 * Mount the OxaPay webhook at `/oxapay/webhook` and dispatch events to
 * app-level handlers. The component handles signature verification and
 * idempotent persistence into its own tables; the handlers below are
 * called AFTER that so they can act on the verified, deduped event.
 *
 * Add this URL to your OxaPay dashboard's webhook section:
 *   https://<your-deployment>.convex.site/oxapay/webhook
 *
 * Find it with `npx convex env get CONVEX_SITE_URL` inside example/.
 */
oxapay.registerRoutes(http, {
  path: "/oxapay/webhook",
  events: {
    // Successful payment (any type: invoice, white-label, static, link, donation)
    "payment.paid": async (ctx, event) => {
      const entityId = (event as any).order_id;
      console.log(`[oxapay] payment.paid for ${entityId}: ${(event as any).track_id}`);
      if (entityId) {
        await ctx.runMutation(internal.users.markPremiumByEntityId, { entityId });
      }
    },

    // Specifically for static-address deposits. Useful if you want to credit
    // a user's internal balance for wallet top-ups vs one-shot purchases.
    "static_address.paid": async (_ctx, event) => {
      console.log(
        `[oxapay] static_address deposit: ${(event as any).track_id} amount=${
          (event as any).amount
        } ${(event as any).currency}`,
      );
    },

    // Underpaid: partial payment within `under_paid_coverage` tolerance was
    // accepted. Otherwise the payment moves to "underpaid" without crediting.
    "payment.underpaid": async (_ctx, event) => {
      console.warn(`[oxapay] payment underpaid: ${(event as any).track_id}`);
    },

    "payment.expired": async (_ctx, event) => {
      console.log(`[oxapay] invoice ${(event as any).track_id} expired`);
    },

    // Payout (withdrawal) events, fired with the payout API key as the HMAC secret
    "payout.confirmed": async (_ctx, event) => {
      console.log(`[oxapay] payout ${(event as any).track_id} confirmed`);
    },
    "payout.rejected": async (_ctx, event) => {
      console.warn(`[oxapay] payout ${(event as any).track_id} rejected`);
    },
    "payout.failed": async (_ctx, event) => {
      console.warn(`[oxapay] payout ${(event as any).track_id} failed`);
    },
  },

  // Catch-all, runs AFTER any specific handler above
  onEvent: async (_ctx, event) => {
    console.log(`[oxapay] event seen: type=${(event as any).type} status=${(event as any).status}`);
  },
});

export default http;
