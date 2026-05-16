/**
 * Component schema — the on-Convex mirror of OxaPay objects.
 *
 * Design notes:
 *
 *   - `id` (provider-side track_id) is kept separate from Convex `_id`.
 *     Every external table indexes on `id` for O(1) provider-id lookups.
 *
 *   - `entityId` is the consumer's app-side identifier (a Convex Id<"users">,
 *     an org id, an opaque token — whatever). It is round-tripped through the
 *     OxaPay `order_id` field on payment creation so the webhook handler can
 *     associate incoming events with the right user.
 *
 *   - Status comparisons must be case-insensitive — OxaPay REST returns
 *     lowercase, webhooks return TitleCase. We store the value verbatim;
 *     query callers should `.toLowerCase()` before comparing.
 *
 *   - The `processedWebhooks` table is a dedup ledger. OxaPay does not send
 *     an `event_id`; we hash `track_id + status` and store the hash with a
 *     unique-by-key check so retries don't re-execute downstream effects.
 *
 *   - Timestamps from OxaPay come as Unix seconds (REST) or ISO strings
 *     (webhooks). We coerce everything to numeric `receivedAt` (ms) on write
 *     so range queries are consistent.
 */

import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const vNullableString = v.union(v.string(), v.null());
const vNullableNumber = v.union(v.number(), v.null());

export const txValidator = v.object({
  txHash: v.optional(v.string()),
  amount: v.optional(v.union(v.number(), v.string())),
  currency: v.optional(v.string()),
  network: v.optional(v.string()),
  address: v.optional(v.string()),
  status: v.optional(v.string()),
  confirmations: v.optional(v.number()),
  date: v.optional(v.union(v.number(), v.string())),
  senderAddress: v.optional(v.string()),
  sentAmount: v.optional(v.union(v.number(), v.string())),
  receivedAmount: v.optional(v.union(v.number(), v.string())),
  rate: v.optional(v.union(v.number(), v.string())),
  autoConvert: v.optional(
    v.object({
      processed: v.optional(v.boolean()),
      amount: v.optional(v.union(v.number(), v.string())),
      currency: v.optional(v.string()),
    }),
  ),
  autoWithdrawal: v.optional(
    v.object({
      processed: v.optional(v.boolean()),
      amount: v.optional(v.union(v.number(), v.string())),
      currency: v.optional(v.string()),
      txHash: v.optional(v.string()),
    }),
  ),
});

export default defineSchema(
  {
    /**
     * Optional bridge table: maps your app's `entityId` to a synthetic
     * "customer" record. OxaPay has no first-class customer concept, but
     * keeping this table lets you easily list all payments for a user
     * via the `customerId` index on payments/payouts.
     *
     * It is auto-populated lazily when you create a payment with an
     * `entityId`. You can ignore this table entirely if you only ever
     * look payments up by `entityId` directly.
     */
    customers: defineTable({
      entityId: v.string(),
      email: v.optional(v.string()),
      name: v.optional(vNullableString),
      defaultNetwork: v.optional(v.string()),
      defaultCurrency: v.optional(v.string()),
      metadata: v.optional(v.record(v.string(), v.any())),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
      .index("entityId", ["entityId"])
      .index("email", ["email"]),

    /**
     * Every OxaPay payment record — invoice, white-label, static-address,
     * payment-link, or donation. Mirror updates on every webhook so the
     * consumer can query the latest state without round-tripping to OxaPay.
     */
    payments: defineTable({
      /** OxaPay track_id (primary). */
      id: v.string(),
      /** App-side identifier (e.g. user/org id), or null for anonymous payments. */
      entityId: v.union(v.string(), v.null()),
      /** Optional pointer into the `customers` table. */
      customerId: v.optional(v.id("customers")),
      type: v.string(), // invoice | white_label | static_address | payment_link | donation
      status: v.string(), // OxaPay status, verbatim
      /** Amount as priced (in the invoice currency). */
      amount: v.number(),
      currency: v.string(),
      /** The crypto amount the payer is expected to send. */
      payAmount: v.optional(vNullableNumber),
      payCurrency: v.optional(vNullableString),
      network: v.optional(vNullableString),
      address: v.optional(vNullableString),
      memo: v.optional(vNullableString),
      paymentUrl: v.optional(vNullableString),
      qrCode: v.optional(vNullableString),
      rate: v.optional(vNullableNumber),
      mixedPayment: v.optional(v.boolean()),
      feePaidByPayer: v.optional(v.boolean()),
      underPaidCoverage: v.optional(v.number()),
      lifetime: v.optional(v.number()),
      autoWithdrawal: v.optional(v.boolean()),
      toCurrency: v.optional(vNullableString),
      callbackUrl: v.optional(vNullableString),
      returnUrl: v.optional(vNullableString),
      thanksMessage: v.optional(vNullableString),
      email: v.optional(vNullableString),
      orderId: v.optional(vNullableString),
      description: v.optional(vNullableString),
      /** Free-form metadata mirrored back via the `description` round-trip. */
      metadata: v.optional(v.record(v.string(), v.any())),
      /** Confirmed transaction history. */
      txs: v.optional(v.array(txValidator)),
      /** Unix seconds — when OxaPay created the record. */
      providerCreatedAt: v.optional(v.number()),
      providerExpiredAt: v.optional(v.number()),
      /** ms epoch — when we (the component) first saw it. */
      createdAt: v.number(),
      /** ms epoch — last write into this row. */
      updatedAt: v.number(),
      /** ms epoch — when the payment first reached a terminal-success status (`paid`/`manual_accept`). */
      paidAt: v.optional(v.number()),
    })
      .index("id", ["id"])
      .index("entityId", ["entityId"])
      .index("entityId_status", ["entityId", "status"])
      .index("customerId", ["customerId"])
      .index("status", ["status"])
      .index("orderId", ["orderId"]),

    /**
     * Payout (withdrawal) records, one per `POST /payout` call.
     */
    payouts: defineTable({
      id: v.string(),
      entityId: v.union(v.string(), v.null()),
      customerId: v.optional(v.id("customers")),
      status: v.string(),
      address: v.string(),
      currency: v.string(),
      network: v.optional(vNullableString),
      amount: v.number(),
      fee: v.optional(vNullableNumber),
      txHash: v.optional(vNullableString),
      memo: v.optional(vNullableString),
      description: v.optional(vNullableString),
      callbackUrl: v.optional(vNullableString),
      internal: v.optional(v.boolean()),
      metadata: v.optional(v.record(v.string(), v.any())),
      providerCreatedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      confirmedAt: v.optional(v.number()),
    })
      .index("id", ["id"])
      .index("entityId", ["entityId"])
      .index("entityId_status", ["entityId", "status"])
      .index("customerId", ["customerId"])
      .index("status", ["status"]),

    /**
     * Webhook idempotency ledger. We hash `(trackId, status, txHash?)` and
     * store the digest with a unique index so repeat deliveries become
     * no-ops at the dispatch layer. Records are kept for 30 days.
     */
    processedWebhooks: defineTable({
      /** Stable hash of (trackId, status, txHash?). */
      eventKey: v.string(),
      trackId: v.string(),
      status: v.string(),
      type: v.string(),
      receivedAt: v.number(),
    })
      .index("eventKey", ["eventKey"])
      .index("trackId", ["trackId"])
      .index("receivedAt", ["receivedAt"]),
  },
  { schemaValidation: true },
);
