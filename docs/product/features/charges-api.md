# 4. Charges API

- Priority: P0
- Status: Approved

## Purpose

The core resource. A charge is "this customer owes this merchant this amount in this currency".

## Rules

- `POST /v1/charges` requires an `Idempotency-Key`; a repeat with the same key and body returns the same response; same key with a different body returns `409`
- Amount is an integer in the minor unit + currency code (`USD` 2, `PEN` 2, `USDT` 6, `USDC` 6); non-integers are rejected
- A charge has an expiry (configurable default); after it, no payment is accepted
- States:

```
pending ──▶ processing ──▶ succeeded
   │             └────────▶ failed
   └──────────────────────▶ expired
```

- Transitions happen only in the domain entity; any other transition raises a domain error
- Every state change writes an outbox event in the same transaction
- `GET /v1/charges/:id` and `GET /v1/charges` (cursor pagination), scoped to the organization
- Errors use RFC 9457 Problem Details with a stable `code`

## Acceptance criteria

- [ ] Same `Idempotency-Key` twice → one charge, identical responses
- [ ] `amount: 10.5` is rejected with `400`
- [ ] Illegal transitions (e.g. `succeeded → pending`) are impossible and tested at domain level
- [ ] Listing paginates by cursor and never leaks other organizations' charges

## Out of scope

Refunds, partial captures, currency conversion.
