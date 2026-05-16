/**
 * Optional React helpers for the convex-oxapay component.
 *
 * `OxaPayCheckoutButton` calls a Convex action that creates an invoice and
 * either redirects the browser to the hosted payment URL or opens it in a
 * new tab.
 *
 * `useOxaPayPayment` polls a Convex query for live status updates on a
 * single payment by track id.
 */

import * as React from "react";
import { useAction, useQuery } from "convex/react";
import type { FunctionReference } from "convex/server";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Loose return shape — matches what `oxapay.payments.createInvoice` returns. */
export interface CreateInvoiceResult {
  trackId: string;
  paymentUrl: string;
  expiredAt: number;
  date: number;
}

/** A `oxapay.api()` createInvoice action reference. */
export type CreateInvoiceAction = FunctionReference<
  "action",
  "public",
  Record<string, unknown>,
  CreateInvoiceResult
>;

/** A `getPaymentById`-shaped query reference. */
export type GetPaymentQuery<TPayment = unknown> = FunctionReference<
  "query",
  "public",
  { id: string },
  TPayment | null
>;

// ---------------------------------------------------------------------------
// <OxaPayCheckoutButton />
// ---------------------------------------------------------------------------

export interface OxaPayCheckoutButtonProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onError"> {
  /**
   * A Convex action reference that creates an invoice. Typically:
   *   `api.oxapay.createInvoice` after re-exporting from `oxapay.api()`.
   */
  createInvoice: CreateInvoiceAction;
  /** Args passed to the action (amount, currency, etc.). */
  invoiceArgs: Record<string, unknown>;
  /**
   * What to do once the invoice is created. Defaults to `"redirect"`
   * (replace current tab). `"new-tab"` opens a fresh tab. `"none"` lets
   * the caller handle via `onCreated`.
   */
  mode?: "redirect" | "new-tab" | "none";
  /** Called with the created invoice. Useful when `mode="none"`. */
  onCreated?: (result: CreateInvoiceResult) => void;
  /** Called if the action throws. */
  onError?: (error: unknown) => void;
}

export const OxaPayCheckoutButton = React.forwardRef<
  HTMLButtonElement,
  OxaPayCheckoutButtonProps
>(function OxaPayCheckoutButton(props, ref) {
  const {
    createInvoice,
    invoiceArgs,
    mode = "redirect",
    onCreated,
    onError,
    onClick,
    disabled,
    children,
    ...rest
  } = props;
  const action = useAction(createInvoice);
  const [loading, setLoading] = React.useState(false);

  const handleClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    if (onClick) onClick(e);
    if (e.defaultPrevented) return;
    if (loading || disabled) return;
    setLoading(true);
    try {
      const result = (await action(invoiceArgs as any)) as CreateInvoiceResult;
      onCreated?.(result);
      if (mode === "redirect" && typeof window !== "undefined") {
        window.location.href = result.paymentUrl;
      } else if (mode === "new-tab" && typeof window !== "undefined") {
        window.open(result.paymentUrl, "_blank", "noopener,noreferrer");
      }
    } catch (err) {
      if (onError) onError(err);
      else console.error("[OxaPayCheckoutButton] checkout failed", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      ref={ref}
      type="button"
      disabled={disabled || loading}
      onClick={handleClick}
      {...rest}
    >
      {children ?? (loading ? "Loading…" : "Pay with crypto")}
    </button>
  );
});

// ---------------------------------------------------------------------------
// useOxaPayPayment — live-subscribe to mirrored payment status
// ---------------------------------------------------------------------------

export interface UseOxaPayPaymentOptions {
  /** Argument shape passed to the query — defaults to `{ id: trackId }`. */
  argShape?: "id" | "trackId";
}

/**
 * Subscribe to a payment's mirror row in your Convex DB. Re-renders on
 * status updates. Returns `null` while loading, `null` if no row exists.
 *
 * Pass the consumer's own query reference (typically a query that proxies
 * to `oxapay.payments.get(...)`) so the React app can call it without
 * needing the component's internal API directly.
 *
 * Example consumer query:
 *
 *   export const getPayment = query({
 *     args: { id: v.string() },
 *     handler: async (ctx, args) => {
 *       return await oxapay.payments.get(ctx, { trackId: args.id });
 *     },
 *   });
 */
export function useOxaPayPayment<TPayment = any>(
  query: GetPaymentQuery<TPayment>,
  trackId: string | undefined | null,
): TPayment | null | undefined {
  return useQuery(query, trackId ? ({ id: trackId } as any) : "skip");
}
