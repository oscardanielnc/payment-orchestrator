# 14. Outbound webhooks

- Priority: P1
- Status: Approved

## Purpose

Merchants need to react (for example, ship the order) when a charge succeeds.

## Rules

- The merchant registers an HTTPS endpoint; a signing secret is generated per endpoint
- Events: `charge.succeeded`, `charge.failed`, `charge.expired`, published from the outbox
- Payload signed with HMAC-SHA256 plus a timestamp to prevent replays
- At-least-once delivery: exponential backoff retries; each event has a stable id for dedup on the merchant side
- Delivery attempts are visible in the dashboard

## Acceptance criteria

- [ ] A succeeded charge delivers a signed event to the test endpoint
- [ ] A failing endpoint is retried and the attempts are recorded
- [ ] The verification snippet in the docs validates the signature

## Out of scope

Per-endpoint event filters, manual resend UI.
