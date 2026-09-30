# 0006. Environment policy: test-only by policy, live-ready by design

- Status: Accepted
- Date: 2026-09-28

## Context
This repository must never touch real money, but its code may be reused with real money later.

## Decision
- All configuration parsed by one Zod schema at boot; failure aborts startup
- `PaymentsPolicy` is the only place that knows the mode. This repository accepts only `test`
- Per-provider checks: Stripe key prefixes, TRON host and contract, EVM chain id allow-list (84532)
- Networks, contracts and endpoints are configuration; the core never branches on test/live

## Consequences
- Going live elsewhere = new config + a reviewed change to `PaymentsPolicy` + the "Path to live" items
- Errors name the variable, never its value
