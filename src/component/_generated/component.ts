/* eslint-disable */
/**
 * Generated `ComponentApi` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type { FunctionReference } from "convex/server";

/**
 * A utility for referencing a Convex component's exposed API.
 *
 * Useful when expecting a parameter like `components.myComponent`.
 * Usage:
 * ```ts
 * async function myFunction(ctx: QueryCtx, component: ComponentApi) {
 *   return ctx.runQuery(component.someFile.someQuery, { ...args });
 * }
 * ```
 */
export type ComponentApi<Name extends string | undefined = string | undefined> =
  {
    lib: {
      createInvoiceAction: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          entityId: string | null;
          generalApiKey?: string;
          merchantApiKey?: string;
          metadata?: Record<string, any>;
          payoutApiKey?: string;
          request: {
            amount: number;
            autoWithdrawal?: boolean;
            callbackUrl?: string;
            currency?: string;
            description?: string;
            email?: string;
            feePaidByPayer?: 0 | 1;
            lifetime?: number;
            mixedPayment?: boolean;
            orderId?: string;
            returnUrl?: string;
            sandbox?: boolean;
            thanksMessage?: string;
            toCurrency?: string;
            underPaidCoverage?: number;
          };
        },
        {
          date: number;
          expiredAt: number;
          paymentUrl: string;
          trackId: string;
        },
        Name
      >;
      createPayoutAction: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          entityId: string | null;
          generalApiKey?: string;
          merchantApiKey?: string;
          metadata?: Record<string, any>;
          payoutApiKey?: string;
          request: {
            address: string;
            amount: number;
            callbackUrl?: string;
            currency: string;
            description?: string;
            memo?: string;
            network?: string;
          };
        },
        { status: string; trackId: string },
        Name
      >;
      createStaticAddressAction: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          entityId: string | null;
          generalApiKey?: string;
          merchantApiKey?: string;
          metadata?: Record<string, any>;
          payoutApiKey?: string;
          request: {
            autoWithdrawal?: boolean;
            callbackUrl?: string;
            description?: string;
            email?: string;
            network: string;
            orderId?: string;
            toCurrency?: string;
          };
        },
        {
          address: string;
          memo: string;
          network: string;
          qrCode: string;
          trackId: string;
        },
        Name
      >;
      createWhiteLabelAction: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          entityId: string | null;
          generalApiKey?: string;
          merchantApiKey?: string;
          metadata?: Record<string, any>;
          payoutApiKey?: string;
          request: {
            amount: number;
            callbackUrl?: string;
            currency?: string;
            description?: string;
            email?: string;
            feePaidByPayer?: 0 | 1;
            lifetime?: number;
            network?: string;
            orderId?: string;
            payCurrency: string;
            underPaidCoverage?: number;
          };
        },
        {
          address: string;
          expiredAt: number;
          memo: string;
          network: string;
          payAmount: number;
          payCurrency: string;
          qrCode: string;
          trackId: string;
        },
        Name
      >;
      getCustomerByEntityId: FunctionReference<
        "query",
        "internal",
        { entityId: string },
        null | {
          _creationTime: number;
          _id: string;
          createdAt: number;
          defaultCurrency?: string;
          defaultNetwork?: string;
          email?: string;
          entityId: string;
          metadata?: Record<string, any>;
          name?: string | null;
          updatedAt: number;
        },
        Name
      >;
      getPaymentById: FunctionReference<
        "query",
        "internal",
        { id: string },
        null | {
          _creationTime: number;
          _id: string;
          address?: string | null;
          amount: number;
          autoWithdrawal?: boolean;
          callbackUrl?: string | null;
          createdAt: number;
          currency: string;
          customerId?: string;
          description?: string | null;
          email?: string | null;
          entityId: string | null;
          feePaidByPayer?: boolean;
          id: string;
          lifetime?: number;
          memo?: string | null;
          metadata?: Record<string, any>;
          mixedPayment?: boolean;
          network?: string | null;
          orderId?: string | null;
          paidAt?: number;
          payAmount?: number | null;
          payCurrency?: string | null;
          paymentUrl?: string | null;
          providerCreatedAt?: number;
          providerExpiredAt?: number;
          qrCode?: string | null;
          rate?: number | null;
          returnUrl?: string | null;
          status: string;
          thanksMessage?: string | null;
          toCurrency?: string | null;
          txs?: Array<{
            address?: string;
            amount?: number | string;
            autoConvert?: {
              amount?: number | string;
              currency?: string;
              processed?: boolean;
            };
            autoWithdrawal?: {
              amount?: number | string;
              currency?: string;
              processed?: boolean;
              txHash?: string;
            };
            confirmations?: number;
            currency?: string;
            date?: number | string;
            network?: string;
            rate?: number | string;
            receivedAmount?: number | string;
            senderAddress?: string;
            sentAmount?: number | string;
            status?: string;
            txHash?: string;
          }>;
          type: string;
          underPaidCoverage?: number;
          updatedAt: number;
        },
        Name
      >;
      getPaymentByOrderId: FunctionReference<
        "query",
        "internal",
        { orderId: string },
        null | {
          _creationTime: number;
          _id: string;
          address?: string | null;
          amount: number;
          autoWithdrawal?: boolean;
          callbackUrl?: string | null;
          createdAt: number;
          currency: string;
          customerId?: string;
          description?: string | null;
          email?: string | null;
          entityId: string | null;
          feePaidByPayer?: boolean;
          id: string;
          lifetime?: number;
          memo?: string | null;
          metadata?: Record<string, any>;
          mixedPayment?: boolean;
          network?: string | null;
          orderId?: string | null;
          paidAt?: number;
          payAmount?: number | null;
          payCurrency?: string | null;
          paymentUrl?: string | null;
          providerCreatedAt?: number;
          providerExpiredAt?: number;
          qrCode?: string | null;
          rate?: number | null;
          returnUrl?: string | null;
          status: string;
          thanksMessage?: string | null;
          toCurrency?: string | null;
          txs?: Array<{
            address?: string;
            amount?: number | string;
            autoConvert?: {
              amount?: number | string;
              currency?: string;
              processed?: boolean;
            };
            autoWithdrawal?: {
              amount?: number | string;
              currency?: string;
              processed?: boolean;
              txHash?: string;
            };
            confirmations?: number;
            currency?: string;
            date?: number | string;
            network?: string;
            rate?: number | string;
            receivedAmount?: number | string;
            senderAddress?: string;
            sentAmount?: number | string;
            status?: string;
            txHash?: string;
          }>;
          type: string;
          underPaidCoverage?: number;
          updatedAt: number;
        },
        Name
      >;
      getPayoutById: FunctionReference<
        "query",
        "internal",
        { id: string },
        null | {
          _creationTime: number;
          _id: string;
          address: string;
          amount: number;
          callbackUrl?: string | null;
          confirmedAt?: number;
          createdAt: number;
          currency: string;
          customerId?: string;
          description?: string | null;
          entityId: string | null;
          fee?: number | null;
          id: string;
          internal?: boolean;
          memo?: string | null;
          metadata?: Record<string, any>;
          network?: string | null;
          providerCreatedAt?: number;
          status: string;
          txHash?: string | null;
          updatedAt: number;
        },
        Name
      >;
      ingestWebhookAction: FunctionReference<
        "action",
        "internal",
        { event: any; keyUsed: "merchant" | "payout" },
        {
          alreadyProcessed: boolean;
          status: string;
          trackId: string;
          type: string;
        },
        Name
      >;
      listPaymentsByEntityId: FunctionReference<
        "query",
        "internal",
        { entityId: string; limit?: number; status?: string },
        Array<{
          _creationTime: number;
          _id: string;
          address?: string | null;
          amount: number;
          autoWithdrawal?: boolean;
          callbackUrl?: string | null;
          createdAt: number;
          currency: string;
          customerId?: string;
          description?: string | null;
          email?: string | null;
          entityId: string | null;
          feePaidByPayer?: boolean;
          id: string;
          lifetime?: number;
          memo?: string | null;
          metadata?: Record<string, any>;
          mixedPayment?: boolean;
          network?: string | null;
          orderId?: string | null;
          paidAt?: number;
          payAmount?: number | null;
          payCurrency?: string | null;
          paymentUrl?: string | null;
          providerCreatedAt?: number;
          providerExpiredAt?: number;
          qrCode?: string | null;
          rate?: number | null;
          returnUrl?: string | null;
          status: string;
          thanksMessage?: string | null;
          toCurrency?: string | null;
          txs?: Array<{
            address?: string;
            amount?: number | string;
            autoConvert?: {
              amount?: number | string;
              currency?: string;
              processed?: boolean;
            };
            autoWithdrawal?: {
              amount?: number | string;
              currency?: string;
              processed?: boolean;
              txHash?: string;
            };
            confirmations?: number;
            currency?: string;
            date?: number | string;
            network?: string;
            rate?: number | string;
            receivedAmount?: number | string;
            senderAddress?: string;
            sentAmount?: number | string;
            status?: string;
            txHash?: string;
          }>;
          type: string;
          underPaidCoverage?: number;
          updatedAt: number;
        }>,
        Name
      >;
      listPaymentsByStatus: FunctionReference<
        "query",
        "internal",
        { limit?: number; status: string },
        Array<{
          _creationTime: number;
          _id: string;
          address?: string | null;
          amount: number;
          autoWithdrawal?: boolean;
          callbackUrl?: string | null;
          createdAt: number;
          currency: string;
          customerId?: string;
          description?: string | null;
          email?: string | null;
          entityId: string | null;
          feePaidByPayer?: boolean;
          id: string;
          lifetime?: number;
          memo?: string | null;
          metadata?: Record<string, any>;
          mixedPayment?: boolean;
          network?: string | null;
          orderId?: string | null;
          paidAt?: number;
          payAmount?: number | null;
          payCurrency?: string | null;
          paymentUrl?: string | null;
          providerCreatedAt?: number;
          providerExpiredAt?: number;
          qrCode?: string | null;
          rate?: number | null;
          returnUrl?: string | null;
          status: string;
          thanksMessage?: string | null;
          toCurrency?: string | null;
          txs?: Array<{
            address?: string;
            amount?: number | string;
            autoConvert?: {
              amount?: number | string;
              currency?: string;
              processed?: boolean;
            };
            autoWithdrawal?: {
              amount?: number | string;
              currency?: string;
              processed?: boolean;
              txHash?: string;
            };
            confirmations?: number;
            currency?: string;
            date?: number | string;
            network?: string;
            rate?: number | string;
            receivedAmount?: number | string;
            senderAddress?: string;
            sentAmount?: number | string;
            status?: string;
            txHash?: string;
          }>;
          type: string;
          underPaidCoverage?: number;
          updatedAt: number;
        }>,
        Name
      >;
      listPayoutsByEntityId: FunctionReference<
        "query",
        "internal",
        { entityId: string; limit?: number; status?: string },
        Array<{
          _creationTime: number;
          _id: string;
          address: string;
          amount: number;
          callbackUrl?: string | null;
          confirmedAt?: number;
          createdAt: number;
          currency: string;
          customerId?: string;
          description?: string | null;
          entityId: string | null;
          fee?: number | null;
          id: string;
          internal?: boolean;
          memo?: string | null;
          metadata?: Record<string, any>;
          network?: string | null;
          providerCreatedAt?: number;
          status: string;
          txHash?: string | null;
          updatedAt: number;
        }>,
        Name
      >;
      markWebhookProcessed: FunctionReference<
        "mutation",
        "internal",
        { eventKey: string; status: string; trackId: string; type: string },
        { alreadyProcessed: boolean },
        Name
      >;
      patchPaymentFromWebhook: FunctionReference<
        "mutation",
        "internal",
        {
          id: string;
          patch: {
            amount?: number;
            callbackUrl?: string | null;
            currency?: string;
            description?: string | null;
            email?: string | null;
            entityId?: string | null;
            orderId?: string | null;
            paidAt?: number;
            status: string;
            txs?: Array<{
              address?: string;
              amount?: number | string;
              autoConvert?: {
                amount?: number | string;
                currency?: string;
                processed?: boolean;
              };
              autoWithdrawal?: {
                amount?: number | string;
                currency?: string;
                processed?: boolean;
                txHash?: string;
              };
              confirmations?: number;
              currency?: string;
              date?: number | string;
              network?: string;
              rate?: number | string;
              receivedAmount?: number | string;
              senderAddress?: string;
              sentAmount?: number | string;
              status?: string;
              txHash?: string;
            }>;
            type?: string;
            updatedAt: number;
          };
        },
        null | string,
        Name
      >;
      patchPayoutFromWebhook: FunctionReference<
        "mutation",
        "internal",
        {
          id: string;
          patch: {
            amount?: number;
            callbackUrl?: string | null;
            confirmedAt?: number;
            currency?: string;
            description?: string | null;
            entityId?: string | null;
            network?: string | null;
            status: string;
            txHash?: string | null;
            updatedAt: number;
          };
        },
        null | string,
        Name
      >;
      refreshPaymentAction: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          generalApiKey?: string;
          merchantApiKey?: string;
          payoutApiKey?: string;
          trackId: string;
        },
        null | {
          _creationTime: number;
          _id: string;
          address?: string | null;
          amount: number;
          autoWithdrawal?: boolean;
          callbackUrl?: string | null;
          createdAt: number;
          currency: string;
          customerId?: string;
          description?: string | null;
          email?: string | null;
          entityId: string | null;
          feePaidByPayer?: boolean;
          id: string;
          lifetime?: number;
          memo?: string | null;
          metadata?: Record<string, any>;
          mixedPayment?: boolean;
          network?: string | null;
          orderId?: string | null;
          paidAt?: number;
          payAmount?: number | null;
          payCurrency?: string | null;
          paymentUrl?: string | null;
          providerCreatedAt?: number;
          providerExpiredAt?: number;
          qrCode?: string | null;
          rate?: number | null;
          returnUrl?: string | null;
          status: string;
          thanksMessage?: string | null;
          toCurrency?: string | null;
          txs?: Array<{
            address?: string;
            amount?: number | string;
            autoConvert?: {
              amount?: number | string;
              currency?: string;
              processed?: boolean;
            };
            autoWithdrawal?: {
              amount?: number | string;
              currency?: string;
              processed?: boolean;
              txHash?: string;
            };
            confirmations?: number;
            currency?: string;
            date?: number | string;
            network?: string;
            rate?: number | string;
            receivedAmount?: number | string;
            senderAddress?: string;
            sentAmount?: number | string;
            status?: string;
            txHash?: string;
          }>;
          type: string;
          underPaidCoverage?: number;
          updatedAt: number;
        },
        Name
      >;
      refreshPayoutAction: FunctionReference<
        "action",
        "internal",
        {
          baseUrl?: string;
          generalApiKey?: string;
          merchantApiKey?: string;
          payoutApiKey?: string;
          trackId: string;
        },
        null | {
          _creationTime: number;
          _id: string;
          address: string;
          amount: number;
          callbackUrl?: string | null;
          confirmedAt?: number;
          createdAt: number;
          currency: string;
          customerId?: string;
          description?: string | null;
          entityId: string | null;
          fee?: number | null;
          id: string;
          internal?: boolean;
          memo?: string | null;
          metadata?: Record<string, any>;
          network?: string | null;
          providerCreatedAt?: number;
          status: string;
          txHash?: string | null;
          updatedAt: number;
        },
        Name
      >;
      revokeStaticAddressAction: FunctionReference<
        "action",
        "internal",
        {
          address: string;
          baseUrl?: string;
          generalApiKey?: string;
          merchantApiKey?: string;
          payoutApiKey?: string;
        },
        { ok: boolean },
        Name
      >;
      upsertCustomer: FunctionReference<
        "mutation",
        "internal",
        {
          defaultCurrency?: string;
          defaultNetwork?: string;
          email?: string;
          entityId: string;
          metadata?: Record<string, any>;
          name?: string;
        },
        string,
        Name
      >;
      upsertPayment: FunctionReference<
        "mutation",
        "internal",
        {
          payment: {
            address?: string | null;
            amount: number;
            autoWithdrawal?: boolean;
            callbackUrl?: string | null;
            createdAt: number;
            currency: string;
            customerId?: string;
            description?: string | null;
            email?: string | null;
            entityId: string | null;
            feePaidByPayer?: boolean;
            id: string;
            lifetime?: number;
            memo?: string | null;
            metadata?: Record<string, any>;
            mixedPayment?: boolean;
            network?: string | null;
            orderId?: string | null;
            paidAt?: number;
            payAmount?: number | null;
            payCurrency?: string | null;
            paymentUrl?: string | null;
            providerCreatedAt?: number;
            providerExpiredAt?: number;
            qrCode?: string | null;
            rate?: number | null;
            returnUrl?: string | null;
            status: string;
            thanksMessage?: string | null;
            toCurrency?: string | null;
            txs?: Array<{
              address?: string;
              amount?: number | string;
              autoConvert?: {
                amount?: number | string;
                currency?: string;
                processed?: boolean;
              };
              autoWithdrawal?: {
                amount?: number | string;
                currency?: string;
                processed?: boolean;
                txHash?: string;
              };
              confirmations?: number;
              currency?: string;
              date?: number | string;
              network?: string;
              rate?: number | string;
              receivedAmount?: number | string;
              senderAddress?: string;
              sentAmount?: number | string;
              status?: string;
              txHash?: string;
            }>;
            type: string;
            underPaidCoverage?: number;
            updatedAt: number;
          };
        },
        string,
        Name
      >;
      upsertPayout: FunctionReference<
        "mutation",
        "internal",
        {
          payout: {
            address: string;
            amount: number;
            callbackUrl?: string | null;
            confirmedAt?: number;
            createdAt: number;
            currency: string;
            customerId?: string;
            description?: string | null;
            entityId: string | null;
            fee?: number | null;
            id: string;
            internal?: boolean;
            memo?: string | null;
            metadata?: Record<string, any>;
            network?: string | null;
            providerCreatedAt?: number;
            status: string;
            txHash?: string | null;
            updatedAt: number;
          };
        },
        string,
        Name
      >;
    };
  };
