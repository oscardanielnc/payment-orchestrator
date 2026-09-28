# 6. Webhook ingestion

- Priority: P0
- Status: Approved

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

- [ ] A tampered payload is rejected and not stored
- [ ] The same event delivered 3 times → one charge update, one ledger transaction
- [ ] A failing job retries and lands in the dead-letter queue after the limit
- [ ] The endpoint answers in under 200 ms under normal load

## Out of scope

Replay UI for dead-letter jobs (a script is enough for the MVP).
