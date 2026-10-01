# 0012. Checkout status updates by polling

- Status: Accepted
- Date: 2026-09-28

## Context

The checkout page must show when a payment is confirmed.

## Options considered

- WebSockets: bidirectional, overkill
- Server-Sent Events: push, needs connection handling through proxies
- **Polling** with TanStack Query every 3 s while the page is visible

## Decision

Polling a lightweight public status endpoint, stopping on a final state.

## Consequences

- Up to 3 s of extra latency, negligible next to chain confirmation times
- Can move to SSE later without changing the backend state model
