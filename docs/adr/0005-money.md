# 0005. Money as integer minor units

- Status: Accepted
- Date: 2026-09-28

## Context

Floats cannot represent 0.1 exactly. Crypto needs up to 18 decimals in general; USDT/USDC use 6.

## Decision

- `Money` value object: `amount: bigint` in minor units + `Currency`
- Currency registry declares decimals: USD 2, PEN 2, USDT 6, USDC 6
- Arithmetic only between equal currencies; mixing throws a domain error
- Postgres `NUMERIC(78,0)`; JSON transports amounts as **strings** of integers
- Formatting to decimals happens only at the UI edge

## Consequences

- No rounding errors anywhere in the core
- The API contract rejects decimal amounts and JSON numbers for money
