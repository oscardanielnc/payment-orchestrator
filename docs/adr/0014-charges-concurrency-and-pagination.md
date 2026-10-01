# 0014. Charges: optimistic locking and keyset pagination

- Status: Accepted
- Date: 2026-10-01

## Context

A charge can be changed by several actors at once: a webhook, a chain watcher, the expiry job.
Charge lists grow without bound and new charges keep arriving while a client pages.

## Options considered

- Row lock (`SELECT ... FOR UPDATE`): serializes writers, but holds locks while calling providers
- **Optimistic locking with a `version` column**: no locks; a stale writer fails and retries
- OFFSET pagination: slow on deep pages and skips or repeats rows when new ones arrive
- **Keyset (cursor) pagination** on `(created_at DESC, id DESC)`

## Decision

- `charges.version` starts at 1; updates use `WHERE id = ? AND version = ?` and increment it.
  No row updated → `ConcurrencyConflictError` (`409 concurrency.conflict`, safe to retry)
- Lists return `nextCursor`, an opaque base64url of the last `(createdAt, id)`;
  the next page is rows strictly after it. Index `(organization_id, created_at DESC, id DESC)`

## Consequences

- Writers that collide must reload and retry (jobs will do it automatically)
- Clients cannot jump to page N; they follow cursors
