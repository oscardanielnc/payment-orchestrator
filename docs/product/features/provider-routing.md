# 5. Provider routing

- Priority: P0
- Status: Approved

## Purpose

The "orchestrator" part: the merchant asks for a payment, the system decides who processes it.

## Rules

- Input: payment method (`card`, `mercadopago`, `usdt_tron`, `usdc_base`) + currency
- The routing table is configuration, not code branches in use cases
- Each provider is an adapter behind one `PaymentProvider` port; use cases never import a provider SDK
- No provider for the combination → domain error `unsupported_payment_method`
- The chosen provider and its external reference are stored on the payment attempt
- A charge can have several attempts (e.g. the customer switches method); only one can succeed

## Acceptance criteria

- [ ] `card` + `USD` routes to Stripe; `usdt_tron` + `USDT` routes to the TRON adapter
- [ ] Unsupported combinations return `422` with code `unsupported_payment_method`
- [ ] Use case tests run with a fake provider, no network

## Out of scope

Smart routing (by cost or success rate), automatic failover between providers.
