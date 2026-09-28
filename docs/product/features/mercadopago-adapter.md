# 12. Mercado Pago adapter

- Priority: P1
- Status: Approved

## Purpose

Second fiat provider. Proves the `PaymentProvider` port works for more than one implementation.

## Rules

- Test credentials and test users only
- The charge id travels as the external reference
- Notifications verified with the `x-signature` header (HMAC-SHA256, per Mercado Pago's docs)
- After a notification, the payment status is fetched from the API before changing state
- Every outbound call has a timeout

## Acceptance criteria

- [ ] A test-user payment moves the charge to `succeeded` and writes ledger entries
- [ ] A notification with an invalid signature is rejected
- [ ] Adding this adapter required no change in domain or use cases

## Out of scope

Installments, refunds, other local methods.
