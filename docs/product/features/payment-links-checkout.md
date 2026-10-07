# 11. Payment links & checkout

- Priority: P1
- Status: Done

## Purpose

Lets merchants charge without integrating the API.

## Rules

- A payment link creates (or points to) a charge; its URL uses a non-guessable id
- Public checkout page: merchant, amount, expiry and available methods
- Card methods hand off to the provider's UI; crypto shows address, exact amount, network and QR
- Status updates live on the page (mechanism decided in architecture)
- The page states clearly that it is a test environment

## Acceptance criteria

- [x] Opening a link shows amount and methods; an expired link shows an expired state
- [x] Paying with USDT on Nile updates the page to succeeded without reload
- [x] The checkout never shows or accepts mainnet networks

## How it works

- Every charge has a `checkoutUrl` (`/pay/<token>`, 128 random bits); the dashboard's "New payment link"
  creates a charge and shows it ([ADR 0017](../../adr/0017-payment-links-and-public-checkout.md))
- Public API: `GET /v1/checkout/:token`, `POST /v1/checkout/:token/attempts` (same method → same attempt)
- Page polls every 3 s while visible and stops on a final status ([ADR 0012](../../adr/0012-checkout-status.md))
- Card: Stripe Payment Element with the PaymentIntent's client secret. Crypto: network, exact amount,
  copyable address and QR
- Expired: shown from `expiresAt` at once; the worker stores `expired` for pending charges every minute
- The checkout is its own code-split chunk and never restores a dashboard session

## Out of scope

Per-merchant branding, multiple items, taxes.
