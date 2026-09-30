# 0007. Idempotency keys stored in Postgres

- Status: Accepted
- Date: 2026-09-28

## Context
Clients retry. A retried `POST /v1/charges` must not create two charges.

## Options considered
- Redis with TTL: fast, but not atomic with the charge insert
- **Postgres table in the same transaction as the resource**

## Decision
Table `idempotency_keys` with unique `(organization_id, key)`, a hash of the request body,
status and the stored response. Implemented as an interceptor + use case support:
same key + same body → stored response; same key + different body → `409`; in progress → `409` retryable.
Keys expire after 24 h (cleanup job).

## Consequences
- Exactly-once creation even if the process crashes mid-request
