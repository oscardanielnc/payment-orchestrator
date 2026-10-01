# 4. Charges API

- Priority: P0
- Status: Done

## Purpose

The core resource. A charge is "this customer owes this merchant this amount in this currency".

## Rules

- `POST /v1/charges` requires an `Idempotency-Key`; a repeat with the same key and body returns the same response (byte-identical, `Idempotent-Replayed: true`); same key with a different body returns `409` ([ADR 0007](../../adr/0007-idempotency.md))
- Amount is a **string** of an integer in the minor unit + currency code (`USD` 2, `PEN` 2, `USDT` 6, `USDC` 6); decimals, JSON numbers, zero and unknown fields are rejected
- A charge expires 30 minutes after creation unless `expiresInSeconds` (60 s to 7 days) says otherwise
- States:

```
pending ──▶ processing ──▶ succeeded
   │             └────────▶ failed
   └──────────────────────▶ expired   (only once past expiresAt)
```

- Transitions happen only in the domain entity; any other transition raises `charge.invalid_transition`
- Every state change writes an outbox event (`charge.created`, `charge.processing`, ...) in the same transaction
- `GET /v1/charges/:id` and `GET /v1/charges?limit&cursor` (keyset pagination, newest first), scoped to the organization
- Concurrent updates are detected with optimistic locking ([ADR 0014](../../adr/0014-charges-concurrency-and-pagination.md))
- Errors use RFC 9457 Problem Details with a stable `code`; validation errors list each field

## Acceptance criteria

- [x] Same `Idempotency-Key` twice → one charge, identical responses (also when both arrive at once)
- [x] `amount: 10.5` is rejected with `400`
- [x] Illegal transitions (e.g. `succeeded → pending`) are impossible and tested at domain level (every illegal pair)
- [x] Listing paginates by cursor and never leaks other organizations' charges

## Implementation

- Request/response schemas: `packages/contracts/src/charges.ts` (shared with the dashboard)
- Module `apps/api/src/modules/charges/`; `Money` and the outbox port live in `src/shared/`
- Status transitions are not exposed over HTTP yet: payment attempts (feature 5) and confirmations (features 6–8) drive them

## Out of scope

Refunds, partial captures, currency conversion.
