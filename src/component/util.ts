/**
 * Convert raw OxaPay payloads (REST responses + webhook events) into the
 * validator-shaped DB rows declared in schema.ts.
 *
 * Pure functions, no Convex deps — easy to unit-test in isolation.
 */

import type { Infer } from "convex/values";
import type {
  CreateInvoiceResponse,
  CreateStaticAddressResponse,
  CreateWhiteLabelResponse,
  OxaPayWebhookEvent,
  PaymentRecord,
  PaymentTx,
  PaymentType,
  PayoutRecord,
} from "../client/types.js";
import { isPayoutWebhook } from "../client/types.js";
import { hmacSha512Hex } from "../client/helpers.js";
import schema, { txValidator } from "./schema.js";

export type PaymentDoc = Infer<typeof schema.tables.payments.validator>;
export type PayoutDoc = Infer<typeof schema.tables.payouts.validator>;
export type CustomerDoc = Infer<typeof schema.tables.customers.validator>;
export type TxDoc = Infer<typeof txValidator>;

/** Lowercase status set considered terminal-success for payments. */
export const SUCCESS_STATUSES = new Set<string>(["paid", "manual_accept"]);
/** Lowercase status set considered terminal-failure (no further events expected). */
export const TERMINAL_FAIL_STATUSES = new Set<string>(["expired", "refunded"]);
/** Lowercase status set for payouts considered terminal-success. */
export const PAYOUT_SUCCESS_STATUSES = new Set<string>(["confirmed"]);

export function isSuccessStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  return SUCCESS_STATUSES.has(status.toLowerCase());
}

export function isPayoutSuccessStatus(status: string | undefined | null): boolean {
  if (!status) return false;
  return PAYOUT_SUCCESS_STATUSES.has(status.toLowerCase());
}

/** Coerce a date-ish value (Unix seconds or ISO string) into ms epoch, or undefined. */
export function coerceTimestampMs(input: unknown): number | undefined {
  if (input == null) return undefined;
  if (typeof input === "number" && Number.isFinite(input)) {
    // OxaPay returns Unix seconds (integers between 1e9 and 1e11).
    return input < 1e12 ? Math.round(input * 1000) : Math.round(input);
  }
  if (typeof input === "string") {
    const t = Date.parse(input);
    return Number.isFinite(t) ? t : undefined;
  }
  return undefined;
}

export function toNumber(input: unknown): number | undefined {
  if (input == null) return undefined;
  if (typeof input === "number") return Number.isFinite(input) ? input : undefined;
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (trimmed === "") return undefined;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

export function toBool(input: unknown): boolean | undefined {
  if (typeof input === "boolean") return input;
  if (typeof input === "number") return input !== 0;
  if (typeof input === "string") {
    const v = input.toLowerCase();
    if (v === "true" || v === "1" || v === "yes") return true;
    if (v === "false" || v === "0" || v === "no") return false;
  }
  return undefined;
}

/** Map a PaymentTx (REST or webhook flavor) to the DB tx shape. */
function normalizeTx(tx: PaymentTx): TxDoc {
  return {
    txHash: tx.tx_hash || undefined,
    amount: typeof tx.amount === "number" || typeof tx.amount === "string" ? tx.amount : undefined,
    currency: tx.currency || undefined,
    network: tx.network || undefined,
    address: tx.address || undefined,
    status: tx.status || undefined,
    confirmations: typeof tx.confirmations === "number" ? tx.confirmations : undefined,
    date: tx.date as number | string | undefined,
    senderAddress: tx.sender_address || undefined,
    sentAmount: tx.sent_amount as number | string | undefined,
    receivedAmount: tx.received_amount as number | string | undefined,
    rate: tx.rate as number | string | undefined,
    autoConvert: tx.auto_convert
      ? {
          processed: tx.auto_convert.processed,
          amount: tx.auto_convert.amount,
          currency: tx.auto_convert.currency,
        }
      : undefined,
    autoWithdrawal: tx.auto_withdrawal
      ? {
          processed: tx.auto_withdrawal.processed,
          amount: tx.auto_withdrawal.amount,
          currency: tx.auto_withdrawal.currency,
          txHash: tx.auto_withdrawal.tx_hash,
        }
      : undefined,
  };
}

export function normalizeTxs(txs: PaymentTx[] | undefined): TxDoc[] | undefined {
  if (!txs || txs.length === 0) return undefined;
  return txs.map(normalizeTx);
}

/**
 * Build a payment row from a REST `getPayment` / `listPayments` response.
 * Used by sync loops and the consumer-callable client class.
 */
export function paymentRecordToDoc(
  record: PaymentRecord,
  defaults: { entityId: string | null; metadata?: Record<string, unknown> } = { entityId: null },
): Omit<PaymentDoc, "createdAt" | "updatedAt"> & { createdAt?: number; updatedAt?: number } {
  const status = record.status as string;
  const lowerStatus = status?.toLowerCase?.() ?? "";
  return {
    id: record.track_id,
    entityId: defaults.entityId,
    type: record.type as string,
    status,
    amount: typeof record.amount === "number" ? record.amount : 0,
    currency: record.currency,
    payAmount: undefined,
    payCurrency: undefined,
    network: undefined,
    address: undefined,
    memo: undefined,
    paymentUrl: undefined,
    qrCode: undefined,
    rate: undefined,
    mixedPayment: toBool(record.mixed_payment),
    feePaidByPayer: toBool(record.fee_paid_by_payer),
    underPaidCoverage:
      typeof record.under_paid_coverage === "number" ? record.under_paid_coverage : undefined,
    lifetime: typeof record.lifetime === "number" ? record.lifetime : undefined,
    autoWithdrawal: undefined,
    toCurrency: undefined,
    callbackUrl: record.callback_url ?? null,
    returnUrl: record.return_url ?? null,
    thanksMessage: record.thanks_message ?? null,
    email: record.email ?? null,
    orderId: record.order_id ?? null,
    description: record.description ?? null,
    metadata: defaults.metadata,
    txs: normalizeTxs(record.txs),
    providerCreatedAt: coerceTimestampMs(record.date),
    providerExpiredAt: coerceTimestampMs(record.expired_at),
    paidAt: SUCCESS_STATUSES.has(lowerStatus) ? Date.now() : undefined,
  };
}

/** Patch shape applied on top of an existing row from a webhook event. */
export interface PaymentPatch {
  status: string;
  txs?: TxDoc[];
  paidAt?: number;
  updatedAt: number;
  email?: string | null;
  orderId?: string | null;
  description?: string | null;
  callbackUrl?: string | null;
  amount?: number;
  currency?: string;
  type?: string;
  /** Optional fields we can backfill if the row was created without them. */
  entityId?: string | null;
}

export function paymentWebhookToPatch(event: OxaPayWebhookEvent): PaymentPatch {
  if (isPayoutWebhook(event)) {
    throw new Error("paymentWebhookToPatch called with a payout webhook");
  }
  const status = event.status;
  const lowerStatus = status?.toLowerCase?.() ?? "";
  const amount = toNumber(event.amount);
  const txs = normalizeTxs(event.txs);
  return {
    status,
    txs,
    paidAt: SUCCESS_STATUSES.has(lowerStatus) ? Date.now() : undefined,
    updatedAt: Date.now(),
    email: typeof event.email === "string" ? event.email : undefined,
    orderId: typeof event.order_id === "string" ? event.order_id : undefined,
    description: typeof event.description === "string" ? event.description : undefined,
    callbackUrl: typeof event.callback_url === "string" ? event.callback_url : undefined,
    amount: amount,
    currency: typeof event.currency === "string" ? event.currency : undefined,
    type: typeof event.type === "string" ? (event.type as PaymentType) : undefined,
  };
}

/** Initial row shape created from an invoice creation response. */
export function invoiceResponseToDoc(
  args: { entityId: string | null; metadata?: Record<string, unknown> },
  req: { amount: number; currency: string; description?: string; email?: string; orderId?: string },
  resp: CreateInvoiceResponse,
): Omit<PaymentDoc, "createdAt" | "updatedAt"> {
  return {
    id: resp.track_id,
    entityId: args.entityId,
    type: "invoice",
    status: "new",
    amount: req.amount,
    currency: req.currency,
    payAmount: undefined,
    payCurrency: undefined,
    network: undefined,
    address: undefined,
    memo: undefined,
    paymentUrl: resp.payment_url,
    qrCode: undefined,
    rate: undefined,
    mixedPayment: undefined,
    feePaidByPayer: undefined,
    underPaidCoverage: undefined,
    lifetime: undefined,
    autoWithdrawal: undefined,
    toCurrency: undefined,
    callbackUrl: null,
    returnUrl: null,
    thanksMessage: null,
    email: req.email ?? null,
    orderId: req.orderId ?? null,
    description: req.description ?? null,
    metadata: args.metadata,
    txs: undefined,
    providerCreatedAt: coerceTimestampMs(resp.date),
    providerExpiredAt: coerceTimestampMs(resp.expired_at),
    paidAt: undefined,
  };
}

/** Initial row shape created from a white-label creation response. */
export function whiteLabelResponseToDoc(
  args: { entityId: string | null; metadata?: Record<string, unknown> },
  resp: CreateWhiteLabelResponse,
): Omit<PaymentDoc, "createdAt" | "updatedAt"> {
  return {
    id: resp.track_id,
    entityId: args.entityId,
    type: "white_label",
    status: "waiting",
    amount: resp.amount,
    currency: resp.currency ?? "",
    payAmount: resp.pay_amount ?? null,
    payCurrency: resp.pay_currency ?? null,
    network: resp.network ?? null,
    address: resp.address ?? null,
    memo: resp.memo ?? null,
    paymentUrl: null,
    qrCode: resp.qr_code ?? null,
    rate: resp.rate ?? null,
    mixedPayment: undefined,
    feePaidByPayer: typeof resp.fee_paid_by_payer === "number"
      ? resp.fee_paid_by_payer !== 0
      : undefined,
    underPaidCoverage:
      typeof resp.under_paid_coverage === "number" ? resp.under_paid_coverage : undefined,
    lifetime: typeof resp.lifetime === "number" ? resp.lifetime : undefined,
    autoWithdrawal: undefined,
    toCurrency: undefined,
    callbackUrl: resp.callback_url ?? null,
    returnUrl: null,
    thanksMessage: null,
    email: resp.email ?? null,
    orderId: resp.order_id ?? null,
    description: resp.description ?? null,
    metadata: args.metadata,
    txs: undefined,
    providerCreatedAt: coerceTimestampMs(resp.date),
    providerExpiredAt: coerceTimestampMs(resp.expired_at),
    paidAt: undefined,
  };
}

/** Initial row shape created from a static-address creation response. */
export function staticAddressResponseToDoc(
  args: { entityId: string | null; metadata?: Record<string, unknown> },
  resp: CreateStaticAddressResponse,
  initial: { network: string; toCurrency?: string; callbackUrl?: string; description?: string; email?: string; orderId?: string },
): Omit<PaymentDoc, "createdAt" | "updatedAt"> {
  return {
    id: resp.track_id,
    entityId: args.entityId,
    type: "static_address",
    status: "waiting",
    amount: 0,
    currency: initial.toCurrency ?? "",
    payAmount: null,
    payCurrency: null,
    network: resp.network ?? initial.network,
    address: resp.address,
    memo: resp.memo ?? null,
    paymentUrl: null,
    qrCode: resp.qr_code ?? null,
    rate: null,
    mixedPayment: undefined,
    feePaidByPayer: undefined,
    underPaidCoverage: undefined,
    lifetime: undefined,
    autoWithdrawal: undefined,
    toCurrency: initial.toCurrency ?? null,
    callbackUrl: initial.callbackUrl ?? null,
    returnUrl: null,
    thanksMessage: null,
    email: initial.email ?? null,
    orderId: initial.orderId ?? null,
    description: initial.description ?? null,
    metadata: args.metadata,
    txs: undefined,
    providerCreatedAt: coerceTimestampMs(resp.date),
    providerExpiredAt: undefined,
    paidAt: undefined,
  };
}

/** Convert a REST payout record to a DB row. */
export function payoutRecordToDoc(
  record: PayoutRecord,
  defaults: { entityId: string | null; metadata?: Record<string, unknown> } = { entityId: null },
): Omit<PayoutDoc, "createdAt" | "updatedAt"> & { createdAt?: number; updatedAt?: number } {
  const status = record.status as string;
  const lowerStatus = status?.toLowerCase?.() ?? "";
  return {
    id: record.track_id,
    entityId: defaults.entityId,
    status,
    address: record.address,
    currency: record.currency,
    network: record.network ?? null,
    amount: record.amount,
    fee: typeof record.fee === "number" ? record.fee : null,
    txHash: record.tx_hash ?? null,
    memo: record.memo ?? null,
    description: record.description ?? null,
    callbackUrl: null,
    internal: record.internal,
    metadata: defaults.metadata,
    providerCreatedAt: coerceTimestampMs(record.date),
    confirmedAt: PAYOUT_SUCCESS_STATUSES.has(lowerStatus) ? Date.now() : undefined,
  };
}

/** Payout webhook patch. */
export interface PayoutPatch {
  status: string;
  txHash?: string | null;
  amount?: number;
  currency?: string;
  network?: string | null;
  description?: string | null;
  callbackUrl?: string | null;
  updatedAt: number;
  confirmedAt?: number;
  entityId?: string | null;
}

export function payoutWebhookToPatch(event: OxaPayWebhookEvent): PayoutPatch {
  if (!isPayoutWebhook(event)) {
    throw new Error("payoutWebhookToPatch called with a non-payout webhook");
  }
  const status = event.status;
  const lowerStatus = status?.toLowerCase?.() ?? "";
  return {
    status,
    txHash: typeof event.tx_hash === "string" ? event.tx_hash : null,
    amount: toNumber(event.amount),
    currency: typeof event.currency === "string" ? event.currency : undefined,
    network: typeof event.network === "string" ? event.network : null,
    description: typeof event.description === "string" ? event.description : null,
    callbackUrl: typeof event.callback_url === "string" ? event.callback_url : null,
    updatedAt: Date.now(),
    confirmedAt: PAYOUT_SUCCESS_STATUSES.has(lowerStatus) ? Date.now() : undefined,
  };
}

/**
 * Build a stable dedup key from a webhook event. We can't rely on an
 * `event_id` (OxaPay doesn't send one), so we hash track_id + status + the
 * first tx hash (if any) which is sufficient since each (status, tx) combo
 * fires at most once per delivery cycle.
 */
export async function buildEventKey(event: OxaPayWebhookEvent): Promise<string> {
  const trackId = String(event.track_id ?? "");
  const status = String(event.status ?? "");
  const type = String(event.type ?? "");
  let firstTxHash = "";
  if (!isPayoutWebhook(event) && Array.isArray(event.txs) && event.txs.length > 0) {
    const t = event.txs[0];
    firstTxHash = String(t.tx_hash ?? "");
  } else if (isPayoutWebhook(event) && typeof event.tx_hash === "string") {
    firstTxHash = event.tx_hash;
  }
  const material = `${type}|${trackId}|${status.toLowerCase()}|${firstTxHash}`;
  // Use a fixed sentinel "key" (the algorithm has the secret built in via HMAC).
  // We just want a deterministic short fingerprint, not a security check.
  const digest = await hmacSha512Hex("oxapay-event-key-v1", material);
  return digest.slice(0, 32);
}

const REFUND_STATUSES = new Set<string>(["refunding", "refunded"]);

/**
 * Should a webhook with `incoming.status` overwrite a row already at
 * `existing.status`?
 *
 * Allowed transitions:
 *   - any state → same state (tx list / metadata may have grown)
 *   - any non-terminal state → any state
 *   - paid / manual_accept → refunding / refunded (refund flow)
 *
 * Blocked transitions:
 *   - paid / manual_accept → anything except refund / same state
 *   - expired / refunded → anything except same state
 */
export function shouldApplyPaymentStatusTransition(
  existing: string | undefined,
  incoming: string,
): boolean {
  if (!existing) return true;
  const e = existing.toLowerCase();
  const i = incoming.toLowerCase();
  if (e === i) return true;
  if (SUCCESS_STATUSES.has(e)) {
    return REFUND_STATUSES.has(i);
  }
  if (TERMINAL_FAIL_STATUSES.has(e)) {
    return false;
  }
  return true;
}
