# 0017. Payment links: a checkout token per charge and a public checkout API

- Status: Accepted
- Date: 2026-10-07

## Context

Feature 11 lets a customer pay from a link, with no API key and no session. Something in the URL
has to grant access to one charge, and the public endpoints must show only what paying needs.

## Options considered

- Charge id in the URL: random enough, but the API handle becomes a public capability, cannot be
  rotated, and leaks into every merchant integration
- Signed token (HMAC of the id): stateless, but revoking one link means rotating the key for all
- Reusable link entity that creates a charge per visit (Stripe Payment Links): more than the MVP
- **Stored random token per charge**: 128 bits (`randomBytes(16)` → base64url), unique column

## Decision

- A payment link is a charge: `checkoutUrl = CHECKOUT_BASE_URL/<checkoutToken>`, also returned by
  the API so integrations can redirect to the hosted checkout
- Public `GET /v1/checkout/:token` and `POST /v1/checkout/:token/attempts`, rate-limited per IP.
  The view has no ids and no merchant reference; malformed and unknown tokens get the same 404
- Choosing a method that already has an open attempt returns it (same address, same
  PaymentIntent), so the public POST needs no `Idempotency-Key`
- Card uses Stripe's Payment Element; `STRIPE_PUBLISHABLE_KEY` (pk_test_ only) is required with
  the secret key
- A pending charge past its expiry shows as expired at once; a worker sweep stores `expired` every
  minute. Charges already `processing` are not expired: a payment may be on its way

## Consequences

- Existing charges got a token in the migration (`gen_random_uuid`, 122 bits)
- A leaked link exposes amount and merchant name only, and can only be used to pay
- Reusable links (one URL, many customers) remain a later feature on top of this
