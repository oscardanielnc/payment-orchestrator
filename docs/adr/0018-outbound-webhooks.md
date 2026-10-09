# 0018. Outbound webhooks: per-endpoint deliveries, encrypted secrets, signed retries

- Status: Accepted
- Date: 2026-10-09

## Context

Feature 14: merchants must learn that a charge succeeded, failed or expired, even if their server is
down for a while, and must be able to prove a request came from us.

## Options considered

- Send from the relay directly: one slow merchant blocks every other event
- Hash the signing secret like API keys: impossible, signing needs the secret in clear
- Store the secret in clear: a database dump leaks every merchant's secret
- **A delivery row per (endpoint, event), its own queue, the secret encrypted with AES-256-GCM**

## Decision

- `domain-events` consumer fans out `charge.succeeded|failed|expired` to every enabled endpoint of
  the organization; `(endpoint_id, event_id)` is unique, so a re-relayed event adds nothing
- Rows commit, then one job per delivery goes to `webhook-deliveries` (jobId = delivery id), with its
  own backoff: 8 attempts from 30 s (≈ 1 h). A sweep re-enqueues deliveries never tried
- Every attempt is stored (status code, error, duration); the dashboard shows them
- `PO-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>`; the timestamp is signed,
  receivers reject it after 5 minutes. `PO-Event-Id` is the outbox event id, stable for dedup
- The secret (`whsec_…`) is shown once and stored AES-256-GCM encrypted with `WEBHOOK_SECRETS_KEY`,
  which lives outside the database
- SSRF: HTTPS only, no credentials, no private or IP-literal hosts, no redirects followed, 10 s timeout.
  `http://localhost` is allowed outside production for the local test receiver

## Consequences

- At-least-once: merchants must deduplicate by event id (documented in the snippet)
- DNS names that resolve to private IPs are not blocked yet (DNS rebinding); a later hardening step
- Rotating `WEBHOOK_SECRETS_KEY` needs a re-encryption script (versioned format `v1.` allows it)
