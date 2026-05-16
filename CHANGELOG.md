# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] (2026-05-16)

### Changed

- README: simplified installation to `npm install convex-oxapay` (npm 7+ auto-installs the `convex` peer dependency).

## [0.1.0] (2026-05-16)

### Added

- Initial release of `convex-oxapay`, an OxaPay payments component for Convex.
- `OxaPay` client class with sub-APIs for `payments`, `staticAddresses`, `payouts`, `swap`, `account`, and `common` reference data.
- HTTP route registration via `oxapay.registerRoutes(http)` with HMAC-SHA512 signature verification (merchant key for payment events, payout key for payout events).
- Idempotent webhook handling via a `processedWebhooks` dedup ledger keyed on `(type, trackId, status, txHash)`.
- Forward-only payment status transitions (won't downgrade `paid` → `waiting`) with explicit refund-flow support (`paid` → `refunding` → `refunded`).
- Local mirror of payments and payouts in the component's own tables so consumers can `useQuery` live status without API round-trips.
- `oxapay.api({ resolve })` for one-line export of common Convex actions (`createInvoice`, `createPayout`, `listMyPayments`, etc.).
- Optional React subpath (`convex-oxapay/react`) with `<OxaPayCheckoutButton />` and `useOxaPayPayment()` hook.
- `convex-oxapay/test` helper for `convex-test` integration.
- Comprehensive test suite (65 tests across helpers, HTTP client, webhook verifier, util, and component lib).
- Example app demonstrating the end-to-end checkout flow.
