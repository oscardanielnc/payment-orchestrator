# 12. Mercado Pago adapter

- Priority: P1
- Status: Done ([ADR 0022](../../adr/0022-mercadopago-checkout-pro.md))

## Purpose

Second fiat provider. Proves the `PaymentProvider` port works for more than one implementation.

## Rules

- Test credentials and test users only: at boot the token must belong to a `test_user`
- The attempt id travels as the external reference (a charge can have several attempts; ADR 0022)
- Notifications verified with the `x-signature` header (HMAC-SHA256, per Mercado Pago's docs)
- After a notification, the payment status is fetched from the API before changing state
- Every outbound call has a timeout

## Acceptance criteria

- [ ] A test-user payment moves the charge to `succeeded` and writes ledger entries
- [x] A notification with an invalid signature is rejected
- [x] Adding this adapter required no change in domain or use cases

## Out of scope

Installments, refunds, other local methods.
