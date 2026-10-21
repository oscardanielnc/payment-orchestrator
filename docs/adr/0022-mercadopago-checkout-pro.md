# 0022. Mercado Pago: Checkout Pro, attempt id as reference, test user checked at boot

- Status: Accepted
- Date: 2026-10-21

## Context

Feature 12 adds Mercado Pago (Peru, PEN) as the second fiat provider. Its test tokens start with
`APP_USR-` exactly like live ones, so ADR 0006's format checks cannot tell them apart. Notifications
only say "payment X changed" and are signed with `x-signature`.

## Options considered

- Checkout API (our own card form with MP's SDK): more UI, and cards would touch our page
- Accept any `APP_USR-` token and trust the developer: breaks "never live" (ADR 0006)
- Charge id as external reference (the feature's first draft): a charge can have several attempts,
  so a payment could not name its attempt
- **Checkout Pro (redirect), attempt id as external reference, test user asked at boot**

## Decision

- `MercadoPagoProvider` creates a preference (`unit_price` built from the integer string, never by
  float division) with `external_reference = attempt id`; instructions are `redirect` to `init_point`
- At boot, `GET /users/me` must carry the `test_user` tag or the app refuses to start; if Mercado
  Pago cannot be asked, it does not start either (fail closed)
- Notifications: `x-signature` HMAC-SHA256 over `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`,
  live-mode rejected; the handler fetches the payment before changing state
- `approved` → paid; `rejected`/`cancelled` → declined (the preference stays open, ADR 0016)
- Status check (ADR 0019) and reconciliation (ADR 0021) search payments by external reference

## Consequences

- No change in domain or use cases: one adapter, one handler, one verifier, one recon source
- Two approved payments on one preference show up as a reconciliation amount mismatch
- Testing needs a public URL for notifications (a tunnel); without it the status check still settles
