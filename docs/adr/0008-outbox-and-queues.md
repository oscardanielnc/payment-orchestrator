# 0008. Outbox, BullMQ queues and inbound webhook pipeline

- Status: Accepted
- Date: 2026-09-28

## Context
Events must never be lost if the process dies between saving and publishing.
Webhooks must be acknowledged fast and processed safely.

## Decision
- **Outbox**: events written in the same transaction as the change; the worker relays them to BullMQ and marks them sent
- **Inbound**: verify signature on the raw body → insert raw event (unique provider + event id) → `2xx` → enqueue
- **Queues**: BullMQ on Redis, exponential backoff, dead-letter queue after the limit
- Consumers are idempotent; delivery is at-least-once everywhere

## Consequences
- Redis loss does not lose events (Postgres is the source); the relay re-publishes
- Every consumer must tolerate duplicates
