/**
 * convex-oxapay — OxaPay Convex component, consumer-facing client.
 *
 * Usage:
 *
 *   // 1. Register the component:
 *   // convex/convex.config.ts
 *   import { defineApp } from "convex/server";
 *   import oxapay from "convex-oxapay/convex.config";
 *   const app = defineApp();
 *   app.use(oxapay);
 *   export default app;
 *
 *   // 2. Instantiate the client:
 *   // convex/oxapay.ts
 *   import { OxaPay } from "convex-oxapay";
 *   import { components } from "./_generated/api";
 *   export const oxapay = new OxaPay(components.oxapay, {
 *     // merchantApiKey: process.env.OXAPAY_MERCHANT_API_KEY,  // optional override
 *     // payoutApiKey:   process.env.OXAPAY_PAYOUT_API_KEY,
 *     // generalApiKey:  process.env.OXAPAY_GENERAL_API_KEY,
 *   });
 *
 *   // 3. Register the webhook route:
 *   // convex/http.ts
 *   import { httpRouter } from "convex/server";
 *   import { oxapay } from "./oxapay";
 *   const http = httpRouter();
 *   oxapay.registerRoutes(http, {
 *     events: {
 *       "invoice.paid": async (ctx, event) => { ... },
 *     },
 *   });
 *   export default http;
 *
 *   // 4. Call the API:
 *   // convex/checkout.ts
 *   import { action } from "./_generated/server";
 *   import { v } from "convex/values";
 *   import { oxapay } from "./oxapay";
 *
 *   export const createInvoice = action({
 *     args: { amount: v.number() },
 *     handler: async (ctx, args) => {
 *       const identity = await ctx.auth.getUserIdentity();
 *       if (!identity) throw new Error("not authenticated");
 *       return await oxapay.payments.createInvoice(ctx, {
 *         entityId: identity.subject,
 *         amount: args.amount,
 *         currency: "USD",
 *         description: "Premium upgrade",
 *       });
 *     },
 *   });
 */

import {
  actionGeneric,
  type GenericActionCtx,
  type GenericDataModel,
  httpActionGeneric,
  type HttpRouter,
} from "convex/server";
import { ConvexError, v } from "convex/values";

import type { ComponentApi } from "../component/_generated/component.js";
import { OxaPayClient } from "./http.js";
import type {
  AcceptedCurrenciesResponse,
  BalanceResponse,
  ListPaymentsArgs,
  ListPayoutsArgs,
  ListStaticAddressArgs,
  OxaPayCurrenciesResponse,
  OxaPayFiatsResponse,
  OxaPayMonitorResponse,
  OxaPayPaginatedList,
  OxaPayPricesResponse,
  OxaPayServer,
  OxaPayWebhookEvent,
  PaymentRecord,
  PayoutRecord,
  StaticAddressListItem,
  SwapCalculateResponse,
  SwapHistoryArgs,
  SwapPair,
  SwapRateResponse,
  SwapResponse,
} from "./types.js";
import { WebhookVerificationError } from "./errors.js";
import { verifyOxaPayWebhook, webhookAckResponse } from "./webhook.js";

// Re-export the public surface
export type {
  ComponentApi,
  OxaPayWebhookEvent,
  AcceptedCurrenciesResponse,
  BalanceResponse,
  ListPaymentsArgs,
  ListPayoutsArgs,
  ListStaticAddressArgs,
  OxaPayCurrenciesResponse,
  OxaPayFiatsResponse,
  OxaPayMonitorResponse,
  OxaPayPaginatedList,
  OxaPayPricesResponse,
  OxaPayServer,
  PaymentRecord,
  PayoutRecord,
  StaticAddressListItem,
  SwapCalculateResponse,
  SwapHistoryArgs,
  SwapPair,
  SwapRateResponse,
  SwapResponse,
};
export { OxaPayClient };
export {
  OxaPayApiError,
  OxaPayError,
  OxaPayNetworkError,
  WebhookVerificationError,
} from "./errors.js";
export { verifyOxaPayWebhook, webhookAckResponse } from "./webhook.js";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface OxaPayConfig {
  /** API key for /payment/* endpoints. Defaults to `process.env.OXAPAY_MERCHANT_API_KEY`. */
  merchantApiKey?: string;
  /** API key for /payout/* endpoints. Defaults to `process.env.OXAPAY_PAYOUT_API_KEY`. */
  payoutApiKey?: string;
  /** API key for /general/* endpoints. Defaults to `process.env.OXAPAY_GENERAL_API_KEY`. */
  generalApiKey?: string;
  /** Base URL override. Defaults to `process.env.OXAPAY_BASE_URL` or `https://api.oxapay.com/v1`. */
  baseUrl?: string;
  /** Default `callback_url` to send with all payment/payout requests that don't override it. */
  defaultCallbackUrl?: string;
  /** Whether to enable `sandbox: true` by default on all `createInvoice` calls. */
  sandbox?: boolean;
}

// ---------------------------------------------------------------------------
// Context shorthands
// ---------------------------------------------------------------------------

export type RunQueryCtx = { runQuery: GenericActionCtx<GenericDataModel>["runQuery"] };
export type RunMutationCtx = RunQueryCtx & {
  runMutation: GenericActionCtx<GenericDataModel>["runMutation"];
};
export type RunActionCtx = RunMutationCtx & {
  runAction: GenericActionCtx<GenericDataModel>["runAction"];
};

// ---------------------------------------------------------------------------
// Webhook event handler types
// ---------------------------------------------------------------------------

/**
 * A handler for a specific OxaPay webhook event. Receives the action ctx
 * and the parsed event payload.
 */
export type OxaPayEventHandler = (
  ctx: GenericActionCtx<GenericDataModel>,
  event: OxaPayWebhookEvent,
) => Promise<void> | void;

/**
 * Map of event-key to handler. Keys are namespaced by event family + status:
 *   - "invoice.paid", "invoice.waiting", "invoice.paying", "invoice.expired"
 *   - "white_label.paid", "white_label.paying", ...
 *   - "static_address.paid", ...
 *   - "payment_link.paid", ...
 *   - "donation.paid", ...
 *   - "payout.confirmed", "payout.confirming", "payout.failed", "payout.rejected"
 *   - "payment.paid"  (catches any payment-family event with that status)
 *   - "payment.*"     (catches any payment-family event regardless of status)
 *   - "payout.*"      (catches any payout event regardless of status)
 *   - "*"             (catches every event, runs after the more specific handler)
 *
 * Matching is most-specific-wins, then less-specific, then `*` last. All
 * matched handlers run sequentially in that order.
 */
export type OxaPayEventHandlers = Record<string, OxaPayEventHandler>;

export interface RegisterRoutesConfig {
  /** Path the webhook is mounted at. Defaults to `/oxapay/webhook`. */
  path?: string;
  /** Per-event handlers — see {@link OxaPayEventHandlers}. */
  events?: OxaPayEventHandlers;
  /** Single catch-all handler invoked for every event. Runs AFTER `events[...]` matches. */
  onEvent?: OxaPayEventHandler;
  /** Override `merchantApiKey` purely for webhook verification. */
  merchantApiKey?: string;
  /** Override `payoutApiKey` purely for webhook verification. */
  payoutApiKey?: string;
}

// ---------------------------------------------------------------------------
// Helpers — pick event-handler keys by specificity
// ---------------------------------------------------------------------------

function buildEventKeys(event: OxaPayWebhookEvent): string[] {
  const type = String(event.type ?? "").toLowerCase();
  const status = String(event.status ?? "").toLowerCase();
  const isPayout = type === "payout";
  const family = isPayout ? "payout" : "payment";
  const keys: string[] = [];
  if (type && status) keys.push(`${type}.${status}`);
  if (type) keys.push(`${type}.*`);
  if (!isPayout && status) keys.push(`${family}.${status}`);
  keys.push(`${family}.*`);
  keys.push("*");
  return keys;
}

// ---------------------------------------------------------------------------
// The OxaPay client class
// ---------------------------------------------------------------------------

export class OxaPay {
  public readonly component: ComponentApi;
  private readonly merchantApiKey: string;
  private readonly payoutApiKey: string;
  private readonly generalApiKey: string;
  private readonly baseUrl: string | undefined;
  private readonly defaultCallbackUrl: string | undefined;
  private readonly sandbox: boolean;

  constructor(component: ComponentApi, config: OxaPayConfig = {}) {
    this.component = component;
    this.merchantApiKey =
      config.merchantApiKey ?? readEnv("OXAPAY_MERCHANT_API_KEY") ?? "";
    this.payoutApiKey = config.payoutApiKey ?? readEnv("OXAPAY_PAYOUT_API_KEY") ?? "";
    this.generalApiKey = config.generalApiKey ?? readEnv("OXAPAY_GENERAL_API_KEY") ?? "";
    this.baseUrl = config.baseUrl ?? readEnv("OXAPAY_BASE_URL");
    this.defaultCallbackUrl = config.defaultCallbackUrl;
    this.sandbox = Boolean(
      config.sandbox ?? (readEnv("OXAPAY_SANDBOX")?.toLowerCase() === "true"),
    );
  }

  // -------------------------------------------------------------------------
  // A raw HTTP client for unsupported endpoints — escape hatch.
  // -------------------------------------------------------------------------

  /** Construct an `OxaPayClient` configured with this instance's keys. */
  rawClient(): OxaPayClient {
    return new OxaPayClient({
      merchantApiKey: this.merchantApiKey || undefined,
      payoutApiKey: this.payoutApiKey || undefined,
      generalApiKey: this.generalApiKey || undefined,
      baseUrl: this.baseUrl,
    });
  }

  private actionKeyArgs() {
    return {
      merchantApiKey: this.merchantApiKey || undefined,
      payoutApiKey: this.payoutApiKey || undefined,
      generalApiKey: this.generalApiKey || undefined,
      baseUrl: this.baseUrl,
    };
  }

  // -------------------------------------------------------------------------
  // Bridge — let consumers look up the customer for an entityId
  // -------------------------------------------------------------------------

  /** Get or create a `customers` row mapped to the given entityId. */
  async upsertCustomer(
    ctx: RunMutationCtx,
    args: {
      entityId: string;
      email?: string;
      name?: string;
      defaultNetwork?: string;
      defaultCurrency?: string;
      metadata?: Record<string, unknown>;
    },
  ): Promise<string> {
    return await ctx.runMutation(this.component.lib.upsertCustomer, args);
  }

  /** Look up the bridge customer row by entityId (null if none). */
  async getCustomerByEntityId(ctx: RunQueryCtx, entityId: string): Promise<any | null> {
    return await ctx.runQuery(this.component.lib.getCustomerByEntityId, { entityId });
  }

  // -------------------------------------------------------------------------
  // payments — high-level surface
  // -------------------------------------------------------------------------

  public readonly payments = {
    /**
     * Create a hosted invoice on OxaPay and return its URL + track id. The
     * resulting payment is mirrored into the component's `payments` table
     * immediately; subsequent status updates are applied via webhook.
     */
    createInvoice: async (
      ctx: RunActionCtx,
      args: {
        entityId: string | null;
        amount: number;
        currency?: string;
        lifetime?: number;
        feePaidByPayer?: 0 | 1;
        underPaidCoverage?: number;
        toCurrency?: string;
        autoWithdrawal?: boolean;
        mixedPayment?: boolean;
        callbackUrl?: string;
        returnUrl?: string;
        email?: string;
        orderId?: string;
        thanksMessage?: string;
        description?: string;
        sandbox?: boolean;
        metadata?: Record<string, unknown>;
      },
    ): Promise<{ trackId: string; paymentUrl: string; expiredAt: number; date: number }> => {
      return await ctx.runAction(this.component.lib.createInvoiceAction, {
        ...this.actionKeyArgs(),
        entityId: args.entityId,
        metadata: args.metadata,
        request: {
          amount: args.amount,
          currency: args.currency,
          lifetime: args.lifetime,
          feePaidByPayer: args.feePaidByPayer,
          underPaidCoverage: args.underPaidCoverage,
          toCurrency: args.toCurrency,
          autoWithdrawal: args.autoWithdrawal,
          mixedPayment: args.mixedPayment,
          callbackUrl: args.callbackUrl ?? this.defaultCallbackUrl,
          returnUrl: args.returnUrl,
          email: args.email,
          orderId: args.orderId,
          thanksMessage: args.thanksMessage,
          description: args.description,
          sandbox: args.sandbox ?? (this.sandbox || undefined),
        },
      });
    },

    /**
     * Create a white-label payment — you get the raw address, amount, and
     * QR code back so you can render your own UI.
     */
    createWhiteLabel: async (
      ctx: RunActionCtx,
      args: {
        entityId: string | null;
        payCurrency: string;
        amount: number;
        currency?: string;
        network?: string;
        lifetime?: number;
        feePaidByPayer?: 0 | 1;
        underPaidCoverage?: number;
        callbackUrl?: string;
        email?: string;
        orderId?: string;
        description?: string;
        metadata?: Record<string, unknown>;
      },
    ): Promise<{
      trackId: string;
      address: string;
      payAmount: number;
      payCurrency: string;
      network: string;
      memo: string;
      qrCode: string;
      expiredAt: number;
    }> => {
      return await ctx.runAction(this.component.lib.createWhiteLabelAction, {
        ...this.actionKeyArgs(),
        entityId: args.entityId,
        metadata: args.metadata,
        request: {
          payCurrency: args.payCurrency,
          amount: args.amount,
          currency: args.currency,
          network: args.network,
          lifetime: args.lifetime,
          feePaidByPayer: args.feePaidByPayer,
          underPaidCoverage: args.underPaidCoverage,
          callbackUrl: args.callbackUrl ?? this.defaultCallbackUrl,
          email: args.email,
          orderId: args.orderId,
          description: args.description,
        },
      });
    },

    /** Refresh a payment by re-fetching from OxaPay (useful as a fallback to webhooks). */
    refresh: async (ctx: RunActionCtx, args: { trackId: string }): Promise<any | null> => {
      return await ctx.runAction(this.component.lib.refreshPaymentAction, {
        ...this.actionKeyArgs(),
        trackId: args.trackId,
      });
    },

    /** Get the mirrored payment row by track id. */
    get: async (ctx: RunQueryCtx, args: { trackId: string }): Promise<any | null> => {
      return await ctx.runQuery(this.component.lib.getPaymentById, { id: args.trackId });
    },

    /** List a user's payments (most recent first). */
    listForEntity: async (
      ctx: RunQueryCtx,
      args: { entityId: string; status?: string; limit?: number },
    ): Promise<any[]> => {
      return await ctx.runQuery(this.component.lib.listPaymentsByEntityId, args);
    },

    /** List payments by status across all users. */
    listByStatus: async (
      ctx: RunQueryCtx,
      args: { status: string; limit?: number },
    ): Promise<any[]> => {
      return await ctx.runQuery(this.component.lib.listPaymentsByStatus, args);
    },

    /** Look up by your `order_id` (the one you supplied at creation). */
    getByOrderId: async (
      ctx: RunQueryCtx,
      args: { orderId: string },
    ): Promise<any | null> => {
      return await ctx.runQuery(this.component.lib.getPaymentByOrderId, args);
    },

    /** Fetch the payment history directly from OxaPay (bypasses the mirror). */
    listFromProvider: async (
      args: ListPaymentsArgs = {},
    ): Promise<OxaPayPaginatedList<PaymentRecord>> => {
      return await this.rawClient().listPayments(args);
    },
  };

  // -------------------------------------------------------------------------
  // staticAddresses
  // -------------------------------------------------------------------------

  public readonly staticAddresses = {
    /** Create a permanent deposit address for an entity. Auto-revoked after 6mo of inactivity. */
    create: async (
      ctx: RunActionCtx,
      args: {
        entityId: string | null;
        network: string;
        toCurrency?: string;
        autoWithdrawal?: boolean;
        callbackUrl?: string;
        email?: string;
        orderId?: string;
        description?: string;
        metadata?: Record<string, unknown>;
      },
    ): Promise<{
      trackId: string;
      address: string;
      network: string;
      memo: string;
      qrCode: string;
    }> => {
      return await ctx.runAction(this.component.lib.createStaticAddressAction, {
        ...this.actionKeyArgs(),
        entityId: args.entityId,
        metadata: args.metadata,
        request: {
          network: args.network,
          toCurrency: args.toCurrency,
          autoWithdrawal: args.autoWithdrawal,
          callbackUrl: args.callbackUrl ?? this.defaultCallbackUrl,
          email: args.email,
          orderId: args.orderId,
          description: args.description,
        },
      });
    },

    /** Revoke a static address. */
    revoke: async (ctx: RunActionCtx, args: { address: string }): Promise<{ ok: boolean }> => {
      return await ctx.runAction(this.component.lib.revokeStaticAddressAction, {
        ...this.actionKeyArgs(),
        address: args.address,
      });
    },

    /** List static addresses directly from OxaPay. */
    listFromProvider: async (
      args: ListStaticAddressArgs = {},
    ): Promise<OxaPayPaginatedList<StaticAddressListItem>> => {
      return await this.rawClient().listStaticAddresses(args);
    },
  };

  // -------------------------------------------------------------------------
  // payouts
  // -------------------------------------------------------------------------

  public readonly payouts = {
    create: async (
      ctx: RunActionCtx,
      args: {
        entityId: string | null;
        address: string;
        currency: string;
        amount: number;
        network?: string;
        callbackUrl?: string;
        memo?: string;
        description?: string;
        metadata?: Record<string, unknown>;
      },
    ): Promise<{ trackId: string; status: string }> => {
      return await ctx.runAction(this.component.lib.createPayoutAction, {
        ...this.actionKeyArgs(),
        entityId: args.entityId,
        metadata: args.metadata,
        request: {
          address: args.address,
          currency: args.currency,
          amount: args.amount,
          network: args.network,
          callbackUrl: args.callbackUrl ?? this.defaultCallbackUrl,
          memo: args.memo,
          description: args.description,
        },
      });
    },

    refresh: async (ctx: RunActionCtx, args: { trackId: string }): Promise<any | null> => {
      return await ctx.runAction(this.component.lib.refreshPayoutAction, {
        ...this.actionKeyArgs(),
        trackId: args.trackId,
      });
    },

    get: async (ctx: RunQueryCtx, args: { trackId: string }): Promise<any | null> => {
      return await ctx.runQuery(this.component.lib.getPayoutById, { id: args.trackId });
    },

    listForEntity: async (
      ctx: RunQueryCtx,
      args: { entityId: string; status?: string; limit?: number },
    ): Promise<any[]> => {
      return await ctx.runQuery(this.component.lib.listPayoutsByEntityId, args);
    },

    listFromProvider: async (
      args: ListPayoutsArgs = {},
    ): Promise<OxaPayPaginatedList<PayoutRecord>> => {
      return await this.rawClient().listPayouts(args);
    },
  };

  // -------------------------------------------------------------------------
  // swap (no mirroring — direct passthrough)
  // -------------------------------------------------------------------------

  public readonly swap = {
    execute: async (args: {
      fromCurrency: string;
      toCurrency: string;
      amount: number;
    }): Promise<SwapResponse> => {
      return await this.rawClient().createSwap({
        from_currency: args.fromCurrency,
        to_currency: args.toCurrency,
        amount: args.amount,
      });
    },

    calculate: async (args: {
      fromCurrency: string;
      toCurrency: string;
      amount: number;
    }): Promise<SwapCalculateResponse> => {
      return await this.rawClient().calculateSwap({
        from_currency: args.fromCurrency,
        to_currency: args.toCurrency,
        amount: args.amount,
      });
    },

    rate: async (args: { fromCurrency: string; toCurrency: string }): Promise<SwapRateResponse> => {
      return await this.rawClient().swapRate({
        from_currency: args.fromCurrency,
        to_currency: args.toCurrency,
      });
    },

    pairs: async (): Promise<{ list: SwapPair[] }> => {
      return await this.rawClient().swapPairs();
    },

    history: async (
      args: SwapHistoryArgs = {},
    ): Promise<OxaPayPaginatedList<SwapResponse>> => {
      return await this.rawClient().listSwaps(args);
    },
  };

  // -------------------------------------------------------------------------
  // account
  // -------------------------------------------------------------------------

  public readonly account = {
    balance: async (): Promise<BalanceResponse> => {
      return await this.rawClient().balance();
    },
    acceptedCurrencies: async (): Promise<AcceptedCurrenciesResponse> => {
      return await this.rawClient().acceptedCurrencies();
    },
  };

  // -------------------------------------------------------------------------
  // common (unauthenticated reference data)
  // -------------------------------------------------------------------------

  public readonly common = {
    prices: (): Promise<OxaPayPricesResponse> => this.rawClient().prices(),
    currencies: (): Promise<OxaPayCurrenciesResponse> => this.rawClient().currencies(),
    fiats: (): Promise<OxaPayFiatsResponse> => this.rawClient().fiats(),
    networks: (): Promise<{ list: string[] }> => this.rawClient().networks(),
    monitor: (): Promise<OxaPayMonitorResponse> => this.rawClient().monitor(),
  };

  // -------------------------------------------------------------------------
  // Webhook route
  // -------------------------------------------------------------------------

  /**
   * Register an HTTP route that verifies and dispatches OxaPay webhook
   * deliveries. The default path is `/oxapay/webhook`.
   *
   * Verification:
   *   - The signature in the `HMAC` header is checked against the merchant or
   *     payout API key depending on the event's `type` field.
   *   - Invalid signatures return `403 Forbidden`. Missing-config returns
   *     `500 Internal Server Error`. All other errors are caught and
   *     responded with a non-`200` to trigger OxaPay's retry.
   *
   * Built-in side effects (always run on a valid signature):
   *   - Idempotent dedup by `(track_id, status, txHash)` so retried deliveries
   *     are no-ops.
   *   - Upsert / patch into the `payments` or `payouts` table.
   *
   * User handlers (from `events` + `onEvent`) run AFTER the built-in
   * persistence, with the action ctx so they can `ctx.runMutation/runAction`
   * into the consumer's own functions.
   */
  registerRoutes(http: HttpRouter, config: RegisterRoutesConfig = {}): void {
    const path = config.path ?? "/oxapay/webhook";
    const merchantKey = config.merchantApiKey ?? this.merchantApiKey;
    const payoutKey = config.payoutApiKey ?? this.payoutApiKey;

    http.route({
      path,
      method: "POST",
      handler: httpActionGeneric(async (ctx, request) => {
        if (!merchantKey && !payoutKey) {
          console.error(
            "[convex-oxapay] No API keys configured — set OXAPAY_MERCHANT_API_KEY (and OXAPAY_PAYOUT_API_KEY if you accept payout webhooks).",
          );
          return new Response("OxaPay API keys not configured", { status: 500 });
        }

        let rawBody: string;
        try {
          rawBody = await request.text();
        } catch (err) {
          console.error("[convex-oxapay] Failed to read webhook body", err);
          return new Response("Bad Request", { status: 400 });
        }

        const headers: Record<string, string> = {};
        request.headers.forEach((value, key) => {
          headers[key] = value;
        });

        let verified: { event: OxaPayWebhookEvent; keyUsed: "merchant" | "payout" };
        try {
          verified = await verifyOxaPayWebhook({
            rawBody,
            headers,
            merchantApiKey: merchantKey || undefined,
            payoutApiKey: payoutKey || undefined,
          });
        } catch (err) {
          if (err instanceof WebhookVerificationError) {
            console.warn("[convex-oxapay] Webhook verification failed:", err.message);
            return new Response("Forbidden", { status: 403 });
          }
          console.error("[convex-oxapay] Webhook error", err);
          return new Response("Bad Request", { status: 400 });
        }

        // 1. Built-in dedup + mirror update.
        try {
          await ctx.runAction(this.component.lib.ingestWebhookAction, {
            event: verified.event,
            keyUsed: verified.keyUsed,
          });
        } catch (err) {
          console.error("[convex-oxapay] Error ingesting webhook into mirror", err);
          // 500 makes OxaPay retry.
          return new Response("Internal Server Error", { status: 500 });
        }

        // 2. User-defined handlers — match by specificity.
        const handlers = config.events ?? {};
        const handlerKeys = buildEventKeys(verified.event);
        try {
          for (const key of handlerKeys) {
            const h = handlers[key];
            if (h) await h(ctx, verified.event);
          }
          if (config.onEvent) {
            await config.onEvent(ctx, verified.event);
          }
        } catch (err) {
          console.error("[convex-oxapay] Error in user webhook handler", err);
          return new Response("Internal Server Error", { status: 500 });
        }

        // 3. OxaPay requires `200 OK` + body `"ok"` exactly.
        return webhookAckResponse();
      }),
    });
  }

  // -------------------------------------------------------------------------
  // api() — destructurable map of pre-built Convex actions for direct
  // re-export to the frontend. Mirrors the `polar.api()` pattern.
  //
  // The `resolve` callback maps a Convex action context (with the user's
  // auth identity) to an `entityId`. Throws `Not authenticated` if it
  // returns null.
  //
  // Usage:
  //   const { createInvoice, listMyPayments } = oxapay.api({
  //     resolve: async (ctx) => {
  //       const identity = await ctx.auth.getUserIdentity();
  //       return identity ? { entityId: identity.subject } : null;
  //     },
  //   });
  //   export { createInvoice, listMyPayments };
  // -------------------------------------------------------------------------

  api<Resolved extends { entityId: string } = { entityId: string }>(opts: {
    resolve: (
      ctx: GenericActionCtx<GenericDataModel>,
    ) => Promise<Resolved | null> | Resolved | null;
  }) {
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const self = this;
    const resolve = async (ctx: GenericActionCtx<GenericDataModel>): Promise<Resolved> => {
      const r = await opts.resolve(ctx);
      if (!r) throw new ConvexError("Not authenticated");
      return r;
    };

    return {
      createInvoice: actionGeneric({
        args: {
          amount: v.number(),
          currency: v.optional(v.string()),
          description: v.optional(v.string()),
          email: v.optional(v.string()),
          orderId: v.optional(v.string()),
          thanksMessage: v.optional(v.string()),
          returnUrl: v.optional(v.string()),
          lifetime: v.optional(v.number()),
          toCurrency: v.optional(v.string()),
        },
        handler: async (ctx, args) => {
          const r = await resolve(ctx);
          return await self.payments.createInvoice(ctx, {
            entityId: r.entityId,
            ...args,
          });
        },
      }),

      createWhiteLabel: actionGeneric({
        args: {
          payCurrency: v.string(),
          amount: v.number(),
          currency: v.optional(v.string()),
          network: v.optional(v.string()),
          lifetime: v.optional(v.number()),
          description: v.optional(v.string()),
          email: v.optional(v.string()),
          orderId: v.optional(v.string()),
        },
        handler: async (ctx, args) => {
          const r = await resolve(ctx);
          return await self.payments.createWhiteLabel(ctx, {
            entityId: r.entityId,
            ...args,
          });
        },
      }),

      createStaticAddress: actionGeneric({
        args: {
          network: v.string(),
          toCurrency: v.optional(v.string()),
          autoWithdrawal: v.optional(v.boolean()),
          description: v.optional(v.string()),
        },
        handler: async (ctx, args) => {
          const r = await resolve(ctx);
          return await self.staticAddresses.create(ctx, {
            entityId: r.entityId,
            ...args,
          });
        },
      }),

      createPayout: actionGeneric({
        args: {
          address: v.string(),
          currency: v.string(),
          amount: v.number(),
          network: v.optional(v.string()),
          memo: v.optional(v.string()),
          description: v.optional(v.string()),
        },
        handler: async (ctx, args) => {
          const r = await resolve(ctx);
          return await self.payouts.create(ctx, {
            entityId: r.entityId,
            ...args,
          });
        },
      }),

      refreshPayment: actionGeneric({
        args: { trackId: v.string() },
        handler: async (ctx, args): Promise<any | null> => {
          const r = await resolve(ctx);
          const payment = await self.payments.get(ctx, args);
          if (!payment) return null;
          if (payment.entityId !== null && payment.entityId !== r.entityId) {
            throw new ConvexError("Payment does not belong to the current user");
          }
          return await self.payments.refresh(ctx, args);
        },
      }),

      listMyPayments: actionGeneric({
        args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
        handler: async (ctx, args): Promise<any[]> => {
          const r = await resolve(ctx);
          return await self.payments.listForEntity(ctx, { entityId: r.entityId, ...args });
        },
      }),

      listMyPayouts: actionGeneric({
        args: { status: v.optional(v.string()), limit: v.optional(v.number()) },
        handler: async (ctx, args): Promise<any[]> => {
          const r = await resolve(ctx);
          return await self.payouts.listForEntity(ctx, { entityId: r.entityId, ...args });
        },
      }),
    };
  }
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function readEnv(name: string): string | undefined {
  if (typeof process !== "undefined" && process.env) {
    const value = process.env[name];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}
