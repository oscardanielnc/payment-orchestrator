# 14. Outbound webhooks

- Priority: P1
- Status: Done

## Purpose

Merchants need to react (for example, ship the order) when a charge succeeds.

## Rules

- The merchant registers an HTTPS endpoint; a signing secret is generated per endpoint
- Events: `charge.succeeded`, `charge.failed`, `charge.expired`, published from the outbox
- Payload signed with HMAC-SHA256 plus a timestamp to prevent replays
- At-least-once delivery: exponential backoff retries; each event has a stable id for dedup on the merchant side
- Delivery attempts are visible in the dashboard

## Acceptance criteria

- [x] A succeeded charge delivers a signed event to the test endpoint
- [x] A failing endpoint is retried and the attempts are recorded
- [x] The verification snippet in the docs validates the signature

## How it works

- Dashboard → Webhooks (owners add or disable endpoints; everyone sees deliveries and their attempts)
- `POST/GET/DELETE /v1/webhook-endpoints` (owner, signed in) and `GET /v1/webhook-deliveries[/:id]`
- Body: `{ id, type, createdAt, data: { object: "charge", id, status, amount, currency, reference } }`
- Headers: `PO-Signature: t=…,v1=…`, `PO-Event-Id`. Verify with
  [docs/examples/verify-webhook-signature.mjs](../../examples/verify-webhook-signature.mjs)
  (tested against the signer in CI)
- Retries: 8 attempts from 30 s, exponential (≈ 1 h). Design in [ADR 0018](../../adr/0018-outbound-webhooks.md);
  local test in [the runbook](../../runbooks/test-outbound-webhooks.md)

## Out of scope

Per-endpoint event filters, manual resend UI.
