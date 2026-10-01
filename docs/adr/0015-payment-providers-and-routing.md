# 0015. Payment providers: one port, an enabled-providers registry, routing as data

- Status: Accepted
- Date: 2026-10-01

## Context

Four providers (Stripe, Mercado Pago, TRON, Base) must be interchangeable, and an environment may
have only some of them configured. Card and crypto flows differ (client secret vs deposit address).

## Options considered

- `switch (method)` in the use case: every new provider edits the core
- One port per provider family: the router would need to know about families
- **One `PaymentProvider` port returning typed `PaymentInstructions`**

## Decision

- `PaymentProvider.createPayment(request)` → `{ externalReference, instructions }`, where instructions is a
  discriminated union: `card_client_secret`, `redirect`, `crypto_transfer`
- `PAYMENT_ROUTES` maps method + currencies → provider id; `resolveRoute` is a pure function
- `ENABLED_PAYMENT_PROVIDERS` lists the adapters registered in this environment (only those with config);
  a route to a missing provider answers `payment_method.unavailable`
- The provider call runs inside the attempt's transaction, with the attempt id as the provider-side
  idempotency key, so a retry after a failed save never creates a second upstream payment

## Consequences

- Adding a provider = an adapter + one entry in the list + a route; no use case changes
- The transaction stays open during the provider call (hundreds of ms): acceptable at MVP volume;
  revisit with an outbox-driven flow if contention shows up in measurements
