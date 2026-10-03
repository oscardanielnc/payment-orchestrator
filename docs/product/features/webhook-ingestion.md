# 6. Webhook ingestion

- Priority: P0
- Status: Done (verified live on Nile on 2026-10-03)

## Purpose

Providers confirm payments asynchronously. This pipeline makes that reliable.

## Rules

```
provider ─▶ verify signature ─▶ store raw event ─▶ 2xx ─▶ queue ─▶ process (idempotent)
```

- The signature is verified against the **raw** body before any parsing; invalid → `400`, nothing stored
- The raw event is stored with a unique constraint on (provider, external event id); duplicates are acked and ignored
- The response is sent before processing; processing happens in a queue job
- Jobs retry with exponential backoff; after the limit they go to a dead-letter queue
- Processing is idempotent: the same event applied twice produces one state change
- On-chain confirmations (TRON, EVM) enter the same processing step

## Acceptance criteria

- [x] A tampered payload is rejected and not stored
- [x] The same event delivered 3 times → one charge update, one ledger transaction
- [x] A failing job retries and lands in the dead-letter queue after the limit
- [x] The endpoint answers in under 200 ms under normal load

## Implementation

- Module `apps/api/src/modules/inbound/`: `POST /v1/webhooks/:provider` (no API key; the signature authenticates),
  raw event storage, `InboundEventsService` (store once, enqueue after commit), HMAC timestamp verifier
- Worker: `InboundEventsConsumer` (retries, dead-letter), `OutboxRelayService`, `InboundRequeueService`, `DomainEventsConsumer`
- Chain transfers: the TRON watcher now ingests them as inbound events; `ChainTransferHandler` settles them
- No provider verifier is registered yet: Stripe (feature 7) adds the first
- Tests: real Redis and Postgres in containers; duplicates, tampering, retries, dead-letter, relay

## Out of scope

Replay UI for dead-letter jobs (a script is enough for the MVP).
