# 7. Stripe adapter

- Priority: P0
- Status: Done (verified live in Stripe test mode on 2026-10-04: approved, declined then retried, canceled)

## Purpose

First card provider, and the reference adapter for the `PaymentProvider` port.

## Rules

- Uses PaymentIntents; the customer enters card data in Stripe's own UI. Card data never reaches our servers
- The charge id travels in the PaymentIntent metadata; creation sends an idempotency key
- Handled events: `payment_intent.succeeded` (paid), `payment_intent.payment_failed` (decline recorded, charge stays open: [ADR 0016](../../adr/0016-card-declines-keep-charges-open.md)), `payment_intent.canceled` (failed)
- Webhook signature verified via `Stripe-Signature` with the endpoint secret
- Every outbound HTTP call has a timeout
- Local testing with the Stripe CLI (`stripe listen`, `stripe trigger`)

## Acceptance criteria

- [x] Test card `4242 4242 4242 4242` moves the charge to `succeeded` and writes ledger entries
- [x] A declined test card records the decline and keeps the charge open; a canceled intent fails it
- [x] Adapter tests use Stripe test mode or recorded fixtures, never live

## Implementation

- `payments/infrastructure/providers/stripe/`: `StripeCardProvider` (card-only intents, no redirects, attempt id as idempotency key)
- `inbound/infrastructure/signatures/stripe-webhook.verifier.ts`: official SDK `constructEvent`
- `StripeEventHandler` → `SettleProviderPaymentUseCase` (provider-agnostic) → ledger `Dr platform:stripe:receivable / Cr merchant:available`
- Enabled only when `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set; dev tool `stripe:pay <pi> [visa|declined|cancel]`
- Runbook: [test a card payment](../../runbooks/test-a-card-payment-with-stripe.md)

## Out of scope

Refunds, disputes, Stripe Connect, saved cards.
