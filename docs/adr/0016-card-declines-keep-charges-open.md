# 0016. A card decline does not close the charge

- Status: Accepted
- Date: 2026-10-03

## Context

Feature 7 originally said "a declined test card moves the charge to failed". Stripe sends
`payment_intent.payment_failed` on every failed try, but the PaymentIntent goes back to
`requires_payment_method` and the customer can retry on it. A later `succeeded` would then hit a
charge we had already failed: money captured with nowhere to go.

## Options considered

- Fail the charge on `payment_failed` (original spec): simple, wrong as soon as someone retries
- **Record the decline, keep the attempt and charge open; fail only on a terminal event**

## Decision

- `payment_failed` → `attempt.recordDecline(reason)`: stays `pending`, `failureReason` exposed in the API
- `payment_intent.canceled` → attempt `failed`; the charge fails only if no other attempt is still pending
- An amount that differs from the charge is never settled: the event goes to the dead-letter queue
- Settlement logic is provider-agnostic (`SettleProviderPaymentUseCase`); Mercado Pago will reuse it

## Consequences

- A charge with only declines stays `processing` until a payment succeeds, the intent is canceled, or it expires
- The expiry job (worker, later) will move such charges to `expired`
