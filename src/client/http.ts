/**
 * Minimal OxaPay v1 HTTP client.
 *
 * Wraps `fetch` and the standard `{ data, message, error, status, version }`
 * envelope. Each endpoint method is a thin call into `request()`.
 *
 * Auth model: OxaPay uses three independent keys, each sent as a separate
 * custom header (NOT `Authorization: Bearer`):
 *   - `merchant_api_key` for /payment/*
 *   - `payout_api_key`   for /payout/*
 *   - `general_api_key`  for /general/*
 *
 * The caller passes whichever keys it has. Unauthenticated requests
 * (e.g. `/common/*`) are allowed.
 */

import { OxaPayApiError, OxaPayNetworkError } from "./errors.js";
import { buildUrl, stripUndefined } from "./helpers.js";
import {
  OXAPAY_PRODUCTION_BASE_URL,
  type AcceptedCurrenciesResponse,
  type BalanceResponse,
  type CreateInvoiceArgs,
  type CreateInvoiceResponse,
  type CreatePayoutArgs,
  type CreatePayoutResponse,
  type CreateStaticAddressArgs,
  type CreateStaticAddressResponse,
  type CreateWhiteLabelArgs,
  type CreateWhiteLabelResponse,
  type ListPaymentsArgs,
  type ListPayoutsArgs,
  type ListStaticAddressArgs,
  type OxaPayCurrenciesResponse,
  type OxaPayEnvelope,
  type OxaPayFiatsResponse,
  type OxaPayMonitorResponse,
  type OxaPayPaginatedList,
  type OxaPayPricesResponse,
  type PaymentRecord,
  type PayoutRecord,
  type RevokeStaticAddressArgs,
  type StaticAddressListItem,
  type SwapArgs,
  type SwapCalculateArgs,
  type SwapCalculateResponse,
  type SwapHistoryArgs,
  type SwapPair,
  type SwapRateArgs,
  type SwapRateResponse,
  type SwapResponse,
} from "./types.js";

export interface OxaPayClientConfig {
  /** API key for /payment/* endpoints. Required if you call any payment methods. */
  merchantApiKey?: string;
  /** API key for /payout/* endpoints. Required if you call any payout methods. */
  payoutApiKey?: string;
  /** API key for /general/* endpoints (balance + swap). Required if you call those. */
  generalApiKey?: string;
  /** Base URL override. Defaults to `https://api.oxapay.com/v1`. */
  baseUrl?: string;
  /** Override `fetch` (e.g. for testing). Defaults to the global `fetch`. */
  fetch?: typeof fetch;
  /** Per-request timeout in ms. Defaults to 30_000. */
  timeoutMs?: number;
}

type AuthKind = "merchant" | "payout" | "general" | "none";

export class OxaPayClient {
  private readonly merchantApiKey?: string;
  private readonly payoutApiKey?: string;
  private readonly generalApiKey?: string;
  private readonly baseUrl: string;
  private readonly fetchFn: typeof fetch;
  private readonly timeoutMs: number;

  constructor(config: OxaPayClientConfig) {
    this.merchantApiKey = config.merchantApiKey;
    this.payoutApiKey = config.payoutApiKey;
    this.generalApiKey = config.generalApiKey;
    this.baseUrl = config.baseUrl ?? OXAPAY_PRODUCTION_BASE_URL;
    this.fetchFn = config.fetch ?? globalThis.fetch;
    this.timeoutMs = config.timeoutMs ?? 30_000;
  }

  // -------------------------------------------------------------------------
  // Payments (merchant_api_key)
  // -------------------------------------------------------------------------

  createInvoice(args: CreateInvoiceArgs): Promise<CreateInvoiceResponse> {
    return this.request("POST", "/payment/invoice", "merchant", { body: args });
  }

  createWhiteLabel(args: CreateWhiteLabelArgs): Promise<CreateWhiteLabelResponse> {
    return this.request("POST", "/payment/white-label", "merchant", { body: args });
  }

  createStaticAddress(args: CreateStaticAddressArgs): Promise<CreateStaticAddressResponse> {
    return this.request("POST", "/payment/static-address", "merchant", { body: args });
  }

  revokeStaticAddress(args: RevokeStaticAddressArgs): Promise<Record<string, unknown>> {
    return this.request("POST", "/payment/static-address/revoke", "merchant", { body: args });
  }

  listStaticAddresses(
    args: ListStaticAddressArgs = {},
  ): Promise<OxaPayPaginatedList<StaticAddressListItem>> {
    return this.request("GET", "/payment/static-address", "merchant", { query: args });
  }

  /** Fetch a single payment record by track id (covers invoices + white-label + static address). */
  getPayment(trackId: string): Promise<PaymentRecord> {
    return this.request("GET", `/payment/${encodeURIComponent(trackId)}`, "merchant");
  }

  listPayments(args: ListPaymentsArgs = {}): Promise<OxaPayPaginatedList<PaymentRecord>> {
    return this.request("GET", "/payment", "merchant", { query: args });
  }

  acceptedCurrencies(): Promise<AcceptedCurrenciesResponse> {
    return this.request("GET", "/payment/accepted-currencies", "merchant");
  }

  // -------------------------------------------------------------------------
  // Payouts (payout_api_key)
  // -------------------------------------------------------------------------

  createPayout(args: CreatePayoutArgs): Promise<CreatePayoutResponse> {
    return this.request("POST", "/payout", "payout", { body: args });
  }

  getPayout(trackId: string): Promise<PayoutRecord> {
    return this.request("GET", `/payout/${encodeURIComponent(trackId)}`, "payout");
  }

  listPayouts(args: ListPayoutsArgs = {}): Promise<OxaPayPaginatedList<PayoutRecord>> {
    return this.request("GET", "/payout", "payout", { query: args });
  }

  // -------------------------------------------------------------------------
  // Swap + balance (general_api_key)
  // -------------------------------------------------------------------------

  createSwap(args: SwapArgs): Promise<SwapResponse> {
    return this.request("POST", "/general/swap", "general", { body: args });
  }

  listSwaps(args: SwapHistoryArgs = {}): Promise<OxaPayPaginatedList<SwapResponse>> {
    return this.request("GET", "/general/swap", "general", { query: args });
  }

  swapPairs(): Promise<{ list: SwapPair[] }> {
    return this.request("GET", "/general/swap/pairs", "general");
  }

  calculateSwap(args: SwapCalculateArgs): Promise<SwapCalculateResponse> {
    return this.request("POST", "/general/swap/calculate", "general", { body: args });
  }

  swapRate(args: SwapRateArgs): Promise<SwapRateResponse> {
    return this.request("POST", "/general/swap/rate", "general", { body: args });
  }

  /**
   * Returns the account balance per currency. Modern API returns
   * `{ BTC: { available, pending }, USDT: { available, pending } }`.
   * If a legacy deployment returns a flat number, the client coerces it
   * into `{ available, pending: 0 }` for a stable shape.
   */
  async balance(): Promise<BalanceResponse> {
    const raw = await this.request<Record<string, unknown>>(
      "GET",
      "/general/account/balance",
      "general",
    );
    const out: BalanceResponse = {};
    for (const key of Object.keys(raw)) {
      const v = raw[key];
      if (typeof v === "number") {
        out[key] = { available: v, pending: 0 };
      } else if (v && typeof v === "object") {
        const entry = v as { available?: number; pending?: number };
        out[key] = {
          available: typeof entry.available === "number" ? entry.available : 0,
          pending: typeof entry.pending === "number" ? entry.pending : 0,
        };
      }
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Common (no auth)
  // -------------------------------------------------------------------------

  async prices(): Promise<OxaPayPricesResponse> {
    return this.request("GET", "/common/prices", "none");
  }

  async currencies(): Promise<OxaPayCurrenciesResponse> {
    return this.request("GET", "/common/currencies", "none");
  }

  async fiats(): Promise<OxaPayFiatsResponse> {
    return this.request("GET", "/common/fiats", "none");
  }

  async networks(): Promise<{ list: string[] }> {
    return this.request("GET", "/common/networks", "none");
  }

  async monitor(): Promise<OxaPayMonitorResponse> {
    return this.request("GET", "/common/monitor", "none");
  }

  // -------------------------------------------------------------------------
  // Core request machinery
  // -------------------------------------------------------------------------

  private async request<T>(
    method: "GET" | "POST",
    path: string,
    auth: AuthKind,
    opts: { body?: object; query?: object } = {},
  ): Promise<T> {
    const url = buildUrl(this.baseUrl, path, opts.query);
    const headers: Record<string, string> = {
      Accept: "application/json",
      "User-Agent": "convex-oxapay/0.1.0",
    };
    if (auth === "merchant") {
      const key = this.requireKey(this.merchantApiKey, "merchantApiKey", path);
      headers["merchant_api_key"] = key;
    } else if (auth === "payout") {
      const key = this.requireKey(this.payoutApiKey, "payoutApiKey", path);
      headers["payout_api_key"] = key;
    } else if (auth === "general") {
      const key = this.requireKey(this.generalApiKey, "generalApiKey", path);
      headers["general_api_key"] = key;
    }

    let body: string | undefined;
    if (method === "POST") {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body ? stripUndefined(opts.body) : {});
    }

    const controller =
      typeof AbortController !== "undefined" && this.timeoutMs > 0 ? new AbortController() : null;
    const timeoutId = controller
      ? setTimeout(() => controller.abort(), this.timeoutMs)
      : undefined;

    let response: Response;
    try {
      response = await this.fetchFn(url, {
        method,
        headers,
        body,
        signal: controller?.signal,
      });
    } catch (err) {
      throw new OxaPayNetworkError(path, err);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }

    const httpStatus = response.status;
    let envelope: OxaPayEnvelope<T> | null = null;
    try {
      envelope = (await response.json()) as OxaPayEnvelope<T>;
    } catch (err) {
      throw new OxaPayApiError({
        status: httpStatus,
        httpStatus,
        endpoint: path,
        message: `Failed to parse JSON response: ${err instanceof Error ? err.message : String(err)}`,
      });
    }

    if (!envelope || typeof envelope !== "object") {
      throw new OxaPayApiError({
        status: httpStatus,
        httpStatus,
        endpoint: path,
        message: "Empty or non-object response from OxaPay",
      });
    }

    // Trust envelope.status over wire HTTP status (OxaPay returns 403 wire
    // on 401 envelope due to Cloudflare).
    const envelopeStatus =
      typeof envelope.status === "number" ? envelope.status : httpStatus;

    if (envelopeStatus >= 200 && envelopeStatus < 300) {
      return envelope.data as T;
    }

    const errBody = envelope.error && typeof envelope.error === "object"
      ? (envelope.error as { type?: string; key?: string; message?: string })
      : undefined;
    const message =
      (errBody && errBody.message) || envelope.message || `HTTP ${httpStatus}`;
    throw new OxaPayApiError({
      status: envelopeStatus,
      httpStatus,
      endpoint: path,
      message,
      errorBody: errBody,
    });
  }

  private requireKey(key: string | undefined, name: string, endpoint: string): string {
    if (!key) {
      throw new OxaPayApiError({
        status: 401,
        httpStatus: 401,
        endpoint,
        message: `OxaPay ${name} is required for this endpoint. Set it via constructor or env var.`,
      });
    }
    return key;
  }
}
