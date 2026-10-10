# 0019. Status checks as a safety net for missed provider webhooks

- Status: Accepted
- Date: 2026-10-09

## Context

A card payment succeeded at Stripe while `stripe listen` was down: the webhook never arrived and
the charge stayed `processing` although the money was captured. Webhooks are at-least-once only
while the sender can reach us; an outage, a wrong endpoint or a dead tunnel loses them.

## Options considered

- Rely on Stripe's own retries: they cover our downtime in production, not a missing forwarder
  in development or a misconfigured endpoint
- Poll every pending attempt continuously: wastes API calls on abandoned checkouts
- Wait for reconciliation (feature 15): daily, too slow for a customer looking at a spinner
- **Webhooks first; a worker asks the provider about attempts silent for a while**

## Decision

- Providers that report by webhook implement the optional `PaymentProvider.fetchOutcome(ref)`,
  returning only final states (`succeeded`, `canceled`) or `null` while open
- Every minute the worker checks pending attempts untouched for 2 minutes and created within the
  last hour (50 per run), and applies the answer through `SettleProviderPaymentUseCase`, the same
  idempotent path as the webhook
- Declines are not polled: they do not close the charge (ADR 0016) and the webhook reports them

## Consequences

- A lost webhook delays a payment by about 3 minutes instead of leaving it stuck
- At most ~60 status calls per abandoned card attempt; older misses are reconciliation's job
- A late webhook after a status check finds the attempt settled and changes nothing
