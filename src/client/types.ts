/**
 * OxaPay API v1 type definitions.
 *
 * Reference: https://docs.oxapay.com/api-reference
 *
 * All endpoints return a standard envelope:
 *   { data: T, message: string, error: object, status: number, version: string }
 *
 * Wire HTTP status may disagree with the envelope `status` field on auth
 * failures (Cloudflare returns 403 but envelope says 401). Always trust the
 * envelope.
 */

// ---------------------------------------------------------------------------
// Envelope
// ---------------------------------------------------------------------------

export interface OxaPayEnvelope<T> {
  data: T;
  message: string;
  error: OxaPayErrorBody | Record<string, never> | null;
  status: number;
  version: string;
}

export interface OxaPayErrorBody {
  type?: string;
  key?: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Pagination
// ---------------------------------------------------------------------------

export interface OxaPayPaginationMeta {
  page: number;
  last_page: number;
  total: number;
}

export interface OxaPayPaginatedList<T> {
  list: T[];
  meta: OxaPayPaginationMeta;
}

// ---------------------------------------------------------------------------
// Common reference data
// ---------------------------------------------------------------------------

export interface OxaPayNetworkInfo {
  network: string;
  name: string;
  keys: string[];
  required_confirmations: number;
  withdraw_fee: number;
  withdraw_min: number;
  deposit_min: number;
  static_fixed_fee: number;
}

export interface OxaPayCurrencyInfo {
  symbol: string;
  name: string;
  status: boolean;
  networks: Record<string, OxaPayNetworkInfo>;
}

export type OxaPayCurrenciesResponse = Record<string, OxaPayCurrencyInfo>;

export interface OxaPayFiatInfo {
  price: number;
  display_precision: number;
}

export type OxaPayFiatsResponse = Record<string, OxaPayFiatInfo>;

export type OxaPayPricesResponse = Record<string, number>;

/**
 * `/common/monitor` returns `{ status: "OK" }` (string) per live probe,
 * even though the official SDK types it as boolean. We accept either.
 */
export interface OxaPayMonitorResponse {
  status: boolean | string;
}

// ---------------------------------------------------------------------------
// Invoice (`POST /payment/invoice`)
// ---------------------------------------------------------------------------

export interface CreateInvoiceArgs {
  amount: number;
  currency?: string;
  /** minutes — 15..2880, default 60 */
  lifetime?: number;
  /** 0 (merchant) or 1 (payer); send numbers for safety */
  fee_paid_by_payer?: 0 | 1;
  /** % tolerance, 0..60 */
  under_paid_coverage?: number;
  to_currency?: string;
  auto_withdrawal?: 0 | 1 | boolean;
  mixed_payment?: 0 | 1 | boolean;
  callback_url?: string;
  return_url?: string;
  email?: string;
  order_id?: string;
  thanks_message?: string;
  description?: string;
  sandbox?: boolean;
}

export interface CreateInvoiceResponse {
  track_id: string;
  payment_url: string;
  expired_at: number;
  date: number;
}

// ---------------------------------------------------------------------------
// White-label payment (`POST /payment/white-label`)
// ---------------------------------------------------------------------------

export interface CreateWhiteLabelArgs {
  pay_currency: string;
  amount: number;
  currency?: string;
  network?: string;
  lifetime?: number;
  fee_paid_by_payer?: 0 | 1;
  under_paid_coverage?: number;
  callback_url?: string;
  email?: string;
  order_id?: string;
  description?: string;
}

export interface CreateWhiteLabelResponse {
  track_id: string;
  amount: number;
  currency?: string;
  pay_amount: number;
  pay_currency: string;
  network: string;
  address: string;
  memo: string;
  callback_url?: string;
  description?: string;
  email?: string;
  fee_paid_by_payer?: number;
  lifetime?: number;
  order_id?: string;
  under_paid_coverage?: number;
  rate: number;
  qr_code: string;
  expired_at: number;
  date: number;
}

// ---------------------------------------------------------------------------
// Static address (`POST /payment/static-address`)
// ---------------------------------------------------------------------------

export interface CreateStaticAddressArgs {
  network: string;
  to_currency?: string;
  auto_withdrawal?: 0 | 1 | boolean;
  callback_url?: string;
  email?: string;
  order_id?: string;
  description?: string;
}

export interface CreateStaticAddressResponse {
  track_id: string;
  network: string;
  address: string;
  memo: string;
  qr_code: string;
  date: number;
}

export interface RevokeStaticAddressArgs {
  address: string;
}

export interface ListStaticAddressArgs {
  track_id?: string;
  network?: string;
  currency?: string;
  address?: string;
  have_tx?: 0 | 1 | boolean;
  order_id?: string;
  email?: string;
  page?: number;
  size?: number;
}

export interface StaticAddressListItem {
  track_id: string;
  address: string;
  network: string;
  callback_url?: string;
  email?: string;
  order_id?: string;
  description?: string;
  date: number;
}

// ---------------------------------------------------------------------------
// Payment (history + single — `GET /payment` / `GET /payment/{track_id}`)
// ---------------------------------------------------------------------------

export type PaymentType = "invoice" | "white_label" | "static_address" | "payment_link" | "donation";

export type PaymentStatus =
  | "new"
  | "waiting"
  | "paying"
  | "paid"
  | "manual_accept"
  | "underpaid"
  | "refunding"
  | "refunded"
  | "expired";

export interface PaymentTxAutoConvert {
  processed?: boolean;
  amount?: number | string;
  currency?: string;
}

export interface PaymentTxAutoWithdrawal {
  processed?: boolean;
  amount?: number | string;
  currency?: string;
  tx_hash?: string;
}

export interface PaymentTx {
  tx_hash: string;
  amount: number | string;
  currency: string;
  network: string;
  address: string;
  status: string;
  confirmations?: number;
  auto_convert?: PaymentTxAutoConvert;
  auto_withdrawal?: PaymentTxAutoWithdrawal;
  date: number | string;
  /** Webhook-specific extra fields */
  sent_amount?: number | string;
  received_amount?: number | string;
  value?: number | string;
  sent_value?: number | string;
  sender_address?: string;
  rate?: number | string;
}

export interface PaymentRecord {
  track_id: string;
  type: PaymentType;
  amount: number;
  currency: string;
  status: PaymentStatus | string;
  mixed_payment?: boolean | number;
  callback_url?: string;
  description?: string;
  email?: string;
  fee_paid_by_payer?: number | boolean;
  lifetime?: number;
  order_id?: string;
  under_paid_coverage?: number;
  return_url?: string;
  thanks_message?: string;
  expired_at?: number;
  date: number;
  txs?: PaymentTx[];
}

export interface ListPaymentsArgs {
  track_id?: string;
  type?: PaymentType;
  status?: PaymentStatus;
  pay_currency?: string;
  currency?: string;
  network?: string;
  address?: string;
  from_date?: number;
  to_date?: number;
  from_amount?: number;
  to_amount?: number;
  sort_by?: "create_date" | "pay_date" | "amount";
  sort_type?: "asc" | "desc";
  page?: number;
  size?: number;
}

export interface AcceptedCurrenciesResponse {
  list: string[];
}

// ---------------------------------------------------------------------------
// Payout (`POST /payout`, `GET /payout/{track_id}`, `GET /payout`)
// ---------------------------------------------------------------------------

export interface CreatePayoutArgs {
  address: string;
  currency: string;
  amount: number;
  network?: string;
  callback_url?: string;
  memo?: string;
  description?: string;
}

export interface CreatePayoutResponse {
  track_id: string;
  status: string;
}

export type PayoutStatus =
  | "processing"
  | "pending"
  | "confirming"
  | "confirmed"
  | "canceled"
  | "rejected";

export interface PayoutRecord {
  track_id: string;
  address: string;
  currency: string;
  network?: string;
  amount: number;
  fee?: number;
  status: PayoutStatus | string;
  tx_hash?: string;
  description?: string;
  internal?: boolean;
  memo?: string;
  date: number;
}

export interface ListPayoutsArgs {
  status?: PayoutStatus;
  type?: string;
  currency?: string;
  network?: string;
  from_amount?: number;
  to_amount?: number;
  from_date?: number;
  to_date?: number;
  sort_by?: "create_date" | "amount";
  sort_type?: "asc" | "desc";
  size?: number;
  page?: number;
}

// ---------------------------------------------------------------------------
// Swap (`/general/swap*`)
// ---------------------------------------------------------------------------

export interface SwapArgs {
  from_currency: string;
  to_currency: string;
  amount: number;
}

export interface SwapResponse {
  track_id: string;
  from_currency: string;
  to_currency: string;
  from_amount: number;
  to_amount: number;
  rate: number;
  date: number;
}

export interface SwapCalculateArgs {
  from_currency: string;
  to_currency: string;
  amount: number;
}

export interface SwapCalculateResponse {
  to_amount: number;
  rate: number;
  amount: number;
}

export interface SwapRateArgs {
  from_currency: string;
  to_currency: string;
}

export interface SwapRateResponse {
  rate: number;
}

export interface SwapPair {
  from_currency: string;
  to_currency: string;
  min_amount: number;
}

export interface SwapHistoryArgs {
  track_id?: string;
  type?: "autoConvert" | "manualSwap" | "swapByApi";
  from_currency?: string;
  to_currency?: string;
  from_date?: number;
  to_date?: number;
  sort_by?: "create_date" | "amount";
  sort_type?: "asc" | "desc";
  size?: number;
  page?: number;
}

// ---------------------------------------------------------------------------
// Account balance
// ---------------------------------------------------------------------------

export interface BalanceEntry {
  available: number;
  pending: number;
}

/**
 * Modern response shape — each currency maps to { available, pending }.
 * Some older docs show flat numbers; the client coerces both forms.
 */
export type BalanceResponse = Record<string, BalanceEntry>;

// ---------------------------------------------------------------------------
// Webhook payloads
// ---------------------------------------------------------------------------

export interface PaymentWebhookPayload {
  track_id: string;
  status: string;
  type: PaymentType;
  module_name?: string;
  amount: number | string;
  value?: number | string;
  sent_value?: number | string;
  currency: string;
  order_id?: string;
  email?: string;
  note?: string;
  fee_paid_by_payer?: boolean | number;
  under_paid_coverage?: boolean | number;
  description?: string;
  date: string | number;
  callback_url?: string;
  txs?: PaymentTx[];
  [key: string]: unknown;
}

export interface PayoutWebhookPayload {
  track_id: string;
  status: string;
  type: "payout";
  tx_hash?: string;
  address: string;
  amount: number;
  value?: number | string;
  currency: string;
  network: string;
  description?: string;
  date: string | number;
  callback_url?: string;
  [key: string]: unknown;
}

export type OxaPayWebhookEvent = PaymentWebhookPayload | PayoutWebhookPayload;

/**
 * Discriminator helper — true when the webhook concerns a payout (and so
 * should be verified against the payout API key).
 */
export const isPayoutWebhook = (event: OxaPayWebhookEvent): event is PayoutWebhookPayload =>
  event.type === "payout";

// ---------------------------------------------------------------------------
// Misc
// ---------------------------------------------------------------------------

/** Servers OxaPay exposes. */
export type OxaPayServer = "production" | string;

export const OXAPAY_PRODUCTION_BASE_URL = "https://api.oxapay.com/v1";

/** A small allowlist of supported (and well-tested) status values. */
export const PAYMENT_STATUS_SUCCESS_SET = new Set<string>([
  "paid",
  "Paid",
  "manual_accept",
  "Manual_Accept",
]);
