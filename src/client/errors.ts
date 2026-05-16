/**
 * Error classes thrown by the OxaPay HTTP client and webhook verifier.
 *
 * `OxaPayApiError` carries the structured error envelope returned by OxaPay
 * so consumers can branch on `status` or `type`. `WebhookVerificationError`
 * is its own class so the webhook handler can map it to HTTP 401/403.
 */

import type { OxaPayErrorBody } from "./types.js";

/** Base class for all OxaPay-related errors. */
export class OxaPayError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OxaPayError";
  }
}

/** API call failed — status + error body from OxaPay's envelope. */
export class OxaPayApiError extends OxaPayError {
  public readonly status: number;
  public readonly httpStatus: number;
  public readonly endpoint: string;
  public readonly errorBody: OxaPayErrorBody | undefined;

  constructor(args: {
    status: number;
    httpStatus: number;
    endpoint: string;
    message: string;
    errorBody?: OxaPayErrorBody;
  }) {
    super(`OxaPay API error (${args.status}) at ${args.endpoint}: ${args.message}`);
    this.name = "OxaPayApiError";
    this.status = args.status;
    this.httpStatus = args.httpStatus;
    this.endpoint = args.endpoint;
    this.errorBody = args.errorBody;
  }
}

/** Webhook signature did not verify or required headers/secret were missing. */
export class WebhookVerificationError extends OxaPayError {
  constructor(message: string) {
    super(message);
    this.name = "WebhookVerificationError";
  }
}

/** Network or transport error before we got an OxaPay response back. */
export class OxaPayNetworkError extends OxaPayError {
  public readonly endpoint: string;
  public readonly cause: unknown;
  constructor(endpoint: string, cause: unknown) {
    const causeMessage = cause instanceof Error ? cause.message : String(cause);
    super(`OxaPay network error at ${endpoint}: ${causeMessage}`);
    this.name = "OxaPayNetworkError";
    this.endpoint = endpoint;
    this.cause = cause;
  }
}
