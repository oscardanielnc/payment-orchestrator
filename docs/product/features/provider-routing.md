# 5. Provider routing

- Priority: P0
- Status: Done

## Purpose

The "orchestrator" part: the merchant asks for a payment, the system decides who processes it.

## Rules

- Input: payment method (`card`, `mercadopago`, `usdt_tron`, `usdc_base`) + the charge's currency
- The routing table is data (`PAYMENT_ROUTES`), not code branches in use cases ([ADR 0015](../../adr/0015-payment-providers-and-routing.md))
- Each provider is an adapter behind one `PaymentProvider` port; use cases never import a provider SDK
- No route for the combination → `422 payment_method.unsupported`
- Route exists but its provider is not configured in this environment → `422 payment_method.unavailable`
- Starting an attempt needs an open charge (pending or processing, not expired) → otherwise `422 charge.not_payable`
- The first attempt moves the charge to `processing`; switching method adds another attempt and keeps the earlier ones
- The chosen provider, its external reference and the customer instructions are stored on the attempt
- At most one attempt per charge can succeed: entity rule plus a partial unique index in Postgres
- The attempt id is the idempotency key sent to the provider

## Acceptance criteria

- [x] `card` + `USD` routes to Stripe; `usdt_tron` + `USDT` routes to the TRON adapter
- [x] Unsupported combinations return `422` with code `payment_method.unsupported`
- [x] Use case tests run with a fake provider, no network

## Implementation

- Module `apps/api/src/modules/payments/`; the charge is reached only through `ChargePaymentsService`, the charges module's public API
- Endpoints (API key auth): `POST /v1/charges/:id/attempts` (idempotent, `{ method }`), `GET /v1/charges/:id/attempts`
- No real adapter is registered yet: features 7, 8, 12 and 13 add Stripe, TRON, Mercado Pago and Base to `ENABLED_PAYMENT_PROVIDERS`
- E2E tests override that list with fake Stripe and TRON providers

## Out of scope

Smart routing (by cost or success rate), automatic failover between providers.
