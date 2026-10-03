# 0008. Outbox, BullMQ queues and inbound webhook pipeline

- Status: Accepted (revised 2026-10-03 with the implementation)
- Date: 2026-09-28

## Context

Events must never be lost if the process dies between saving and publishing.
Webhooks must be acknowledged fast and processed safely. Chain transfers need the same retries.

## Decision

- **Outbox**: events written in the same transaction as the change; the worker's relay claims them with
  `FOR UPDATE SKIP LOCKED`, enqueues to `domain-events` (jobId = event id) and marks them published
- **Inbound**: verify signature on the raw body → insert raw event (unique provider + external id) →
  commit → enqueue (jobId = event id) → `200`. Chain transfers enter the same table and queue
- Enqueue happens **after** the commit: enqueued inside the transaction, the job can reach the worker
  before the row is visible. A sweeper re-enqueues events still `received` after a minute
- **Queues**: BullMQ on Redis, exponential backoff (`QUEUE_BACKOFF_MS`), `QUEUE_MAX_ATTEMPTS`, then a copy in
  the `dead-letter` queue and the event marked `failed`. `QUEUE_PREFIX` separates environments sharing a Redis
- Handlers are idempotent; delivery is at-least-once. The consumer commits handler effects and "processed" together
- Producers live in the API and the worker; consumers only in the worker. Handlers are composed in the worker,
  so the inbound module depends on no business module

## Consequences

- Redis loss does not lose events (Postgres is the source); relay and sweeper re-publish
- Every consumer must tolerate duplicates
