# 0007. Idempotency keys stored in Postgres

- Status: Accepted (revised 2026-10-01 with the implementation)
- Date: 2026-09-28

## Context

Clients retry. A retried `POST /v1/charges` must not create two charges, even if the
first attempt crashed halfway or both attempts arrive at the same time.

## Options considered

- Redis with TTL: fast, but not atomic with the charge insert
- Postgres row with an `in_progress` status: needs timeouts for crashed requests
- **Claim, work and response in ONE Postgres transaction**

## Decision

`IdempotencyInterceptor` runs the whole handler inside one unit of work:
`INSERT ... ON CONFLICT DO NOTHING` on `(scope, key)` → handler → store status + body.

- Error or crash → rollback frees the key; the client can retry
- Concurrent duplicate → its insert waits on the primary key until the first commits, then replays
- Same key + different request fingerprint (method, path, canonical body) → `409 idempotency.key_reused`
- Scope = organization id. Body stored as **text**, not JSONB: JSONB reorders keys and replays must be byte-identical
- Replays carry `Idempotent-Replayed: true`. Keys expire after 24 h (cleanup job, with the worker)

## Consequences

- Exactly-once creation without an `in_progress` state or timeouts
- The idempotent request holds a transaction for its whole duration: keep these handlers short
