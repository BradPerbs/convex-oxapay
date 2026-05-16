# `convex-oxapay`

[![npm version](https://img.shields.io/npm/v/convex-oxapay.svg)](https://www.npmjs.com/package/convex-oxapay)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Live demo](https://img.shields.io/badge/live-demo-6366f1.svg)](https://convex-oxapay.bradperbs-11a.workers.dev/)

A [Convex Component](https://www.convex.dev/components) for **OxaPay**, the crypto payment gateway that accepts Bitcoin, Ethereum, USDT, USDC, and dozens of other cryptocurrencies on multiple networks.

> 🎮 **Try it live →** [convex-oxapay.bradperbs-11a.workers.dev](https://convex-oxapay.bradperbs-11a.workers.dev/)

`convex-oxapay` gives you:

- **Hosted invoices** with a one-call API and an automatically mirrored status table.
- **White-label payments** for fully custom checkout UIs.
- **Static deposit addresses** for wallet top-ups and crypto subscriptions.
- **Payouts** with status tracking.
- **Swap, balance, prices, and reference data** from a single client object.
- **Webhook handler** with constant-time HMAC-SHA512 verification and idempotent dedup.
- **Live-subscribed React component + hook** for instant payment status updates.

The component mirrors every OxaPay payment and payout into your Convex deployment so you can `useQuery` the latest status from your frontend without round-tripping to OxaPay's API.

---

## Table of contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Quickstart](#quickstart)
- [Webhook setup](#webhook-setup)
- [API reference](#api-reference)
  - [`oxapay.payments`](#oxapaypayments)
  - [`oxapay.staticAddresses`](#oxapaystaticaddresses)
  - [`oxapay.payouts`](#oxapaypayouts)
  - [`oxapay.swap`](#oxapayswap)
  - [`oxapay.account`](#oxapayaccount)
  - [`oxapay.common`](#oxapaycommon)
  - [`oxapay.registerRoutes`](#oxapayregisterroutes)
  - [`oxapay.api({ resolve })`](#oxapayapi-resolve-)
- [React helpers (`convex-oxapay/react`)](#react-helpers-convex-oxapayreact)
- [Tables created in your deployment](#tables-created-in-your-deployment)
- [Status reference](#status-reference)
- [Testing](#testing)
- [Local development](#local-development)
- [Troubleshooting](#troubleshooting)
- [License](#license)

---

## Installation

```bash
npm install convex-oxapay
```

Requires:

- `convex ^1.29.0` (peer dependency, auto-installed by npm 7+; install manually with `npm install convex` if needed)
- An OxaPay account ([sign up](https://oxapay.com)). You'll need at minimum a **Merchant API key**; the Payout key and General key are only required if you use payouts/swap/balance.

### 1. Add the component to your Convex app

```ts
// convex/convex.config.ts
import { defineApp } from "convex/server";
import oxapay from "convex-oxapay/convex.config";

const app = defineApp();
app.use(oxapay);

export default app;
```

### 2. Set environment variables on your Convex deployment

```bash
npx convex env set OXAPAY_MERCHANT_API_KEY  XXXXXX-XXXXXX-XXXXXX-XXXXXX
# Only needed if you create payouts:
npx convex env set OXAPAY_PAYOUT_API_KEY    XXXXXX-XXXXXX-XXXXXX-XXXXXX
# Only needed if you call /general (swap, balance):
npx convex env set OXAPAY_GENERAL_API_KEY   XXXXXX-XXXXXX-XXXXXX-XXXXXX
# Optional: defaults to false. Send sandbox: true on all createInvoice calls.
npx convex env set OXAPAY_SANDBOX           true
```

> ⚠️ OxaPay uses the **merchant or payout API key itself** as the HMAC secret for webhook verification. There is no separate webhook secret. Keep these keys server-side only.

---

## Configuration

```ts
// convex/oxapay.ts
import { OxaPay } from "convex-oxapay";
import { components } from "./_generated/api";

export const oxapay = new OxaPay(components.oxapay, {
  // All fields are optional. Defaults come from env vars.
  merchantApiKey: process.env.OXAPAY_MERCHANT_API_KEY,
  payoutApiKey:   process.env.OXAPAY_PAYOUT_API_KEY,
  generalApiKey:  process.env.OXAPAY_GENERAL_API_KEY,
  baseUrl:        process.env.OXAPAY_BASE_URL,        // for proxies / mocks
  defaultCallbackUrl:
    "https://your-app.convex.site/oxapay/webhook",   // auto-sent on every payment
  sandbox: false,                                     // send sandbox: true by default
});
```

| Config field          | Env var                    | Required for                          |
| --------------------- | -------------------------- | ------------------------------------- |
| `merchantApiKey`      | `OXAPAY_MERCHANT_API_KEY`  | Invoices, white-label, static, webhooks |
| `payoutApiKey`        | `OXAPAY_PAYOUT_API_KEY`    | Payouts + payout webhooks             |
| `generalApiKey`       | `OXAPAY_GENERAL_API_KEY`   | Balance, swap                         |
| `baseUrl`             | `OXAPAY_BASE_URL`          | Optional override                     |
| `sandbox`             | `OXAPAY_SANDBOX`           | Default-on sandbox flag for invoices  |
| `defaultCallbackUrl`  | (none)                     | Convenience: set the webhook URL once |

---

## Quickstart

Once you've registered the component and instantiated `OxaPay`:

```ts
// convex/payments.ts
import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { oxapay } from "./oxapay";

/** Create a USD-priced crypto invoice and return its hosted URL. */
export const createInvoice = action({
  args: { amount: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.subject) throw new Error("Not authenticated");

    const { trackId, paymentUrl } = await oxapay.payments.createInvoice(ctx, {
      entityId: identity.subject,        // links this payment to your user
      amount: args.amount,
      currency: "USD",
      description: "Premium upgrade",
      orderId: identity.subject,         // round-tripped to the webhook
      lifetime: 60,                      // minutes (15..2880)
    });

    return { trackId, paymentUrl };
  },
});

/** Live status query. Re-renders whenever the webhook updates the mirror. */
export const getPayment = query({
  args: { trackId: v.string() },
  handler: async (ctx, args) => {
    return await oxapay.payments.get(ctx, { trackId: args.trackId });
  },
});
```

And in your React frontend:

```tsx
import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";

function PaymentFlow() {
  const [trackId, setTrackId] = useState<string | null>(null);
  const createInvoice = useAction(api.payments.createInvoice);
  const payment = useQuery(
    api.payments.getPayment,
    trackId ? { trackId } : "skip",
  );

  return (
    <>
      <button
        onClick={async () => {
          const { trackId, paymentUrl } = await createInvoice({ amount: 25 });
          setTrackId(trackId);
          window.open(paymentUrl, "_blank");
        }}
      >
        Pay $25 with crypto
      </button>

      {payment && (
        <p>
          Status: <strong>{payment.status}</strong>
        </p>
      )}
    </>
  );
}
```

---

## Webhook setup

OxaPay sends webhooks back to your deployment when a payment changes status. `convex-oxapay` handles signature verification, idempotent dedup, and mirror updates for you.

```ts
// convex/http.ts
import { httpRouter } from "convex/server";
import { internal } from "./_generated/api";
import { oxapay } from "./oxapay";

const http = httpRouter();

oxapay.registerRoutes(http, {
  path: "/oxapay/webhook",         // default
  events: {
    // Fires for invoice / white-label / static-address payments
    "payment.paid": async (ctx, event) => {
      // event.order_id is whatever you sent at creation
      await ctx.runMutation(internal.users.markPremium, {
        entityId: (event as any).order_id,
      });
    },
    "payment.expired": async (ctx, event) => {
      console.log("expired", (event as any).track_id);
    },
    "payout.confirmed": async (ctx, event) => {
      console.log("payout confirmed", (event as any).track_id);
    },
  },
});

export default http;
```

Then in the OxaPay dashboard, set the webhook URL to:

```
https://<your-deployment>.convex.site/oxapay/webhook
```

(Find your deployment URL with `npx convex dashboard` or `npx convex env get CONVEX_SITE_URL`.)

### Event handler keys

You can register handlers at any specificity. **All matching handlers run sequentially**, most-specific first.

| Key                       | Matches                                                                  |
| ------------------------- | ------------------------------------------------------------------------ |
| `invoice.paid`            | Only the `paid` status on hosted invoices                                |
| `invoice.*`               | Every status update on hosted invoices                                   |
| `white_label.paid`        | Only `paid` on white-label payments                                      |
| `static_address.paid`     | Only `paid` on static-address deposits                                   |
| `payment_link.paid`       | Only `paid` on payment links                                             |
| `donation.paid`           | Only `paid` on donations                                                 |
| `payment.paid`            | Any payment-family event with `paid` status                              |
| `payment.*`               | Any payment-family event regardless of status                            |
| `payout.confirmed`        | Only `confirmed` status on payouts                                       |
| `payout.*`                | Any status update on payouts                                             |
| `*`                       | Every event                                                              |

You can also pass `onEvent` for a catch-all that runs **after** the specific handlers.

### Built-in webhook behavior

For every verified delivery, BEFORE your handlers run, the component:

1. **Hashes** `(track_id, status, tx_hash)` and checks the `processedWebhooks` table. Repeat deliveries become no-ops.
2. **Upserts** the payment / payout row in the mirror table.
3. **Forward-only status transitions**: refuses to downgrade `paid` → `waiting`, but allows `paid` → `refunding`.

OxaPay requires `HTTP 200` with body `"ok"` to consider the delivery acknowledged. The component returns exactly that. Any other response triggers OxaPay's retry schedule (5 attempts: 1 min, 3 min, 30 min, 3 h).

---

## API reference

All methods on `oxapay` accept a Convex action ctx (with `runQuery` / `runMutation` / `runAction`) as their first argument. The exceptions are the namespaces that talk directly to OxaPay (`swap`, `account`, `common`) and `staticAddresses.listFromProvider`. Those don't touch the Convex DB so they don't need a ctx.

### `oxapay.payments`

| Method                                        | Purpose                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------- |
| `createInvoice(ctx, args)`                    | Create a hosted invoice on OxaPay and mirror it. Returns the `paymentUrl`. |
| `createWhiteLabel(ctx, args)`                 | Create a white-label payment. Get raw `address`, `payAmount`, `qrCode`.    |
| `refresh(ctx, { trackId })`                   | Re-fetch from OxaPay and update the mirror. Fallback if webhook is missed. |
| `get(ctx, { trackId })`                       | Read the mirror row.                                                       |
| `listForEntity(ctx, { entityId, status?, limit? })` | List payments tied to one `entityId`, optionally filtered by status. |
| `listByStatus(ctx, { status, limit? })`       | List all payments at a given status.                                       |
| `getByOrderId(ctx, { orderId })`              | Look up by the `order_id` you provided at creation.                        |
| `listFromProvider(args)`                      | Bypass the mirror and query OxaPay's `/payment` endpoint directly.         |

`createInvoice` args:

```ts
{
  entityId: string | null;        // your app's user/org id, or null for anonymous
  amount: number;                 // priced amount
  currency?: string;              // default "USD"; supports fiats and cryptos
  lifetime?: number;              // minutes, 15..2880, default 60
  feePaidByPayer?: 0 | 1;         // who pays the OxaPay fee
  underPaidCoverage?: number;     // %, 0..60
  toCurrency?: string;            // auto-convert receipts into this crypto
  autoWithdrawal?: boolean;       // sweep to your linked external wallet
  mixedPayment?: boolean;         // allow paying remainder in a 2nd coin
  callbackUrl?: string;           // override the default callback URL
  returnUrl?: string;
  email?: string;
  orderId?: string;               // round-tripped to the webhook
  thanksMessage?: string;
  description?: string;
  sandbox?: boolean;              // override the global sandbox flag
  metadata?: Record<string, unknown>;  // stored on the mirror row
}
```

### `oxapay.staticAddresses`

```ts
const { trackId, address, qrCode } = await oxapay.staticAddresses.create(ctx, {
  entityId: identity.subject,
  network: "Tron",          // "Bitcoin" | "Ethereum" | "Tron" | "BSC" | etc.
  toCurrency: "USDT",       // auto-convert receipts into USDT
  autoWithdrawal: false,
  description: "Wallet top-up",
});
```

| Method                                      | Purpose                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `create(ctx, args)`                         | Provision a permanent address. Auto-revoked after 6 months of inactivity. |
| `revoke(ctx, { address })`                  | Manually revoke a static address.                                        |
| `listFromProvider(args)`                    | List static addresses from OxaPay (`/payment/static-address`).           |

### `oxapay.payouts`

```ts
const { trackId, status } = await oxapay.payouts.create(ctx, {
  entityId: userId,
  address: "1A1z7agoat...",
  currency: "BTC",
  network: "Bitcoin",
  amount: 0.5,
  description: "Withdrawal request #42",
});
```

| Method                                            | Purpose                                                                        |
| ------------------------------------------------- | ------------------------------------------------------------------------------ |
| `create(ctx, args)`                               | Submit a payout / withdrawal.                                                  |
| `refresh(ctx, { trackId })`                       | Re-fetch and update the mirror.                                                |
| `get(ctx, { trackId })`                           | Read the mirror row.                                                           |
| `listForEntity(ctx, { entityId, status?, limit? })` | List a user's payouts.                                                       |
| `listFromProvider(args)`                          | Bypass the mirror and query OxaPay's `/payout` endpoint directly.              |

### `oxapay.swap`

Direct passthrough to OxaPay's swap engine. Not mirrored locally.

```ts
const { rate } = await oxapay.swap.rate({ fromCurrency: "BTC", toCurrency: "USDT" });
const { toAmount } = await oxapay.swap.calculate({ fromCurrency: "BTC", toCurrency: "USDT", amount: 0.01 });
const swap = await oxapay.swap.execute({ fromCurrency: "BTC", toCurrency: "USDT", amount: 0.01 });
const { list } = await oxapay.swap.pairs();
const history = await oxapay.swap.history({ size: 50 });
```

### `oxapay.account`

```ts
const balance = await oxapay.account.balance();
// { BTC: { available: 0.5, pending: 0 }, USDT: { available: 100, pending: 5 } }
const { list } = await oxapay.account.acceptedCurrencies();
```

### `oxapay.common`

Unauthenticated reference data, useful for building currency pickers.

```ts
await oxapay.common.prices();      // { BTC: 79105.23, ETH: 2228.58, ... }
await oxapay.common.currencies();  // { BTC: { networks: { Bitcoin: { withdraw_fee, ... } } } }
await oxapay.common.fiats();       // { USD: { price: 1, display_precision: 0.001 }, ... }
await oxapay.common.networks();    // { list: ["Bitcoin Network", "Ethereum Network", ...] }
await oxapay.common.monitor();     // { status: "OK" }
```

### `oxapay.registerRoutes`

Mount the webhook handler on a Convex `httpRouter`.

```ts
oxapay.registerRoutes(http, {
  path: "/oxapay/webhook",        // default
  events: { "payment.paid": handler, "payout.confirmed": handler, ... },
  onEvent: async (ctx, event) => { /* catch-all */ },
});
```

### `oxapay.api({ resolve })`

A destructurable bag of pre-built Convex actions. Re-export them and call from your frontend directly. The `resolve` callback maps a Convex auth identity to an `entityId`.

```ts
// convex/oxapay.ts (continued)
export const {
  createInvoice,
  createWhiteLabel,
  createStaticAddress,
  createPayout,
  refreshPayment,
  listMyPayments,
  listMyPayouts,
} = oxapay.api({
  resolve: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    return { entityId: identity.subject };
  },
});
```

Frontend:

```tsx
const createInvoice = useAction(api.oxapay.createInvoice);
const myPayments    = useAction(api.oxapay.listMyPayments);
```

---

## React helpers (`convex-oxapay/react`)

### `<OxaPayCheckoutButton />`

A drop-in button that creates an invoice and either redirects or opens it in a new tab.

```tsx
import { OxaPayCheckoutButton } from "convex-oxapay/react";
import { api } from "../convex/_generated/api";

<OxaPayCheckoutButton
  createInvoice={api.oxapay.createInvoice}
  invoiceArgs={{ amount: 50, currency: "USD" }}
  mode="new-tab"                       // "redirect" | "new-tab" | "none"
  onCreated={(r) => console.log(r)}
  onError={(e) => alert("Failed: " + e)}
>
  Pay $50 with crypto
</OxaPayCheckoutButton>
```

### `useOxaPayPayment(query, trackId)`

A thin wrapper around `useQuery` that subscribes to a payment row by track id.

```tsx
import { useOxaPayPayment } from "convex-oxapay/react";
import { api } from "../convex/_generated/api";

function Status({ trackId }: { trackId: string }) {
  const payment = useOxaPayPayment(api.payments.getPayment, trackId);
  if (!payment) return <p>Loading…</p>;
  return <p>Status: {payment.status}</p>;
}
```

---

## Tables created in your deployment

The component creates these tables inside its isolated namespace (`components.oxapay.*`). They don't pollute your app's schema.

| Table               | Purpose                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `customers`         | Optional bridge: maps your `entityId` to OxaPay-aware customer record. |
| `payments`          | Mirror of every invoice / white-label / static-address / link payment. |
| `payouts`           | Mirror of every withdrawal.                                            |
| `processedWebhooks` | Dedup ledger so retried deliveries are no-ops. Pruned after 30 days.   |

All status comparisons should be case-insensitive. OxaPay returns lowercase via REST (`paid`) and TitleCase via webhooks (`Paid`). The mirror preserves the verbatim casing.

---

## Status reference

### Payment lifecycle

```
new → waiting → paying → paid           ← happy path
                      ↘ underpaid       ← partial payment
                      ↘ expired         ← lifetime elapsed
              paid → refunding → refunded
```

The component's mirror is **forward-only**: `paid` cannot regress to `waiting`, but `paid → refunded` is allowed.

### Payout lifecycle

```
processing → pending → confirming → confirmed
                                  ↘ rejected
                                  ↘ canceled
```

### Recommended `events` map for SaaS billing

```ts
events: {
  "payment.paid":     async (ctx, e) => { /* fulfill order */ },
  "payment.expired":  async (ctx, e) => { /* mark expired   */ },
  "payment.underpaid": async (ctx, e) => { /* notify support */ },
  "payout.confirmed": async (ctx, e) => { /* mark withdrawal complete */ },
  "payout.rejected":  async (ctx, e) => { /* refund the user */ },
}
```

---

## Testing

The package ships a `convex-test` helper at `convex-oxapay/test`:

```ts
// example/convex/setup.test.ts
import { convexTest } from "convex-test";
import schema from "./schema";
import component from "convex-oxapay/test";

const modules = import.meta.glob("./**/*.ts");

export function initConvexTest() {
  const t = convexTest(schema, modules);
  component.register(t);    // registers the "oxapay" component
  return t;
}
```

---

## Local development

A hosted version of the example app is at [convex-oxapay.bradperbs-11a.workers.dev](https://convex-oxapay.bradperbs-11a.workers.dev/). To run it locally:

```bash
git clone https://github.com/bradperbs/convex-oxapay
cd convex-oxapay
npm install
npm run dev          # convex dev + watcher rebuilding TS
npm run dev:frontend # runs the example/ React app on Vite
npm test
npm run build
```

For the example app, set `VITE_CONVEX_URL` in `example/.env.local`:

```env
VITE_CONVEX_URL=https://<your-deployment>.convex.cloud
```

---

## Troubleshooting

### My webhook is returning 403

The signature didn't verify. Common causes:

- You sent `merchant_api_key` from one OxaPay account but the webhook was signed by another.
- A proxy / load balancer is altering the request body before it reaches Convex. The HMAC is computed over the **exact raw bytes**.
- You set the wrong env var (the webhook uses your **merchant** key, or your **payout** key when `event.type === "payout"`).

### My webhook is returning 500

Check the Convex logs. The most likely cause is an error inside your custom event handler. The component catches verification errors but not handler errors (so OxaPay retries on transient failures).

### I'm getting "OxaPay API error (401)"

The key is wrong, blank, or you're calling the wrong endpoint family. Re-check `OXAPAY_MERCHANT_API_KEY` vs `OXAPAY_PAYOUT_API_KEY` vs `OXAPAY_GENERAL_API_KEY`.

### A payment was paid but my user wasn't upgraded

Check the `processedWebhooks` table. The eventKey is `(type, trackId, status, tx_hash)`. If you see the entry, the webhook reached your deployment; the issue is in your handler. If you don't see it, the webhook never arrived. Check the OxaPay dashboard's webhook log.

### Static addresses stopped working after a few months

OxaPay automatically revokes static addresses that have no incoming transactions for 6 months. Recreate the address via `oxapay.staticAddresses.create(...)`.

### My invoice was paid after `expired_at`

Funds sent to an OxaPay invoice address after the lifetime elapses are **unrecoverable**. Always quote a generous lifetime (the maximum is 2880 minutes = 48 hours).

---

## License

Apache-2.0. See [LICENSE](./LICENSE).
