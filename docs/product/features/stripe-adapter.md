# 7. Stripe adapter

- Priority: P0
- Status: Approved

## Purpose

First card provider, and the reference adapter for the `PaymentProvider` port.

## Rules

- Uses PaymentIntents; the customer enters card data in Stripe's own UI. Card data never reaches our servers
- The charge id travels in the PaymentIntent metadata; creation sends an idempotency key
- Handled events: `payment_intent.succeeded`, `payment_intent.payment_failed`
- Webhook signature verified via `Stripe-Signature` with the endpoint secret
- Every outbound HTTP call has a timeout
- Local testing with the Stripe CLI (`stripe listen`, `stripe trigger`)

## Acceptance criteria

- [ ] Test card `4242 4242 4242 4242` moves the charge to `succeeded` and writes ledger entries
- [ ] A declined test card moves it to `failed`
- [ ] Adapter tests use Stripe test mode or recorded fixtures, never live

## Out of scope

Refunds, disputes, Stripe Connect, saved cards.
