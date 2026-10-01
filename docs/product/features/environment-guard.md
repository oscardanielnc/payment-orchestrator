# 1. Environment guard

- Priority: P0
- Status: Done

## Purpose

Makes "test only" a property of the code. On startup the app validates its whole
configuration and aborts if anything is missing or points to real money.

## Rules

- All environment variables are parsed by one schema at startup; missing or invalid values abort the boot
- `PAYMENTS_MODE` is the single policy switch. This repository accepts only `test`
- Rejected, per provider:
  - Stripe: any key that is not `sk_test_` / `rk_test_`
  - Mercado Pago: production credentials (exact detection rule decided in an ADR)
  - TRON: mainnet hosts (`api.trongrid.io`) or a USDT contract other than the configured testnet one
  - EVM: any chain id other than Base Sepolia (84532); explicitly rejects 1 (Ethereum) and 8453 (Base)
- The guard lives in one module. The rest of the code never checks the mode
- The rejection message names the variable, never prints its value

## Acceptance criteria

- [x] Boot with a valid test `.env` succeeds
- [x] Boot with a `sk_live_` key fails with a clear error naming `STRIPE_SECRET_KEY`
- [x] Boot with chain id 8453 fails
- [x] Boot with `PAYMENTS_MODE=live` fails
- [x] No secret value appears in logs or error output

## Implementation

- `apps/api/src/config/`: `env.schema.ts` (shape), `payments-policy.ts` (test-only rules, fail closed),
  `load-config.ts` (runs both, throws `ConfigError`), `config.module.ts` (provides `AppConfig`)
- Validation runs in `main.ts` before Nest builds the DI container
- Every rule is an allow-list: TRON hosts, Base Sepolia chain id, Stripe test prefixes
- Mercado Pago credentials are rejected until feature 12 defines their test rule
- Tests: `load-config.spec.ts` (one per acceptance criterion) and `test/health.e2e-spec.ts`

## Out of scope

Enabling live mode. A future real deployment changes this policy through a reviewed ADR.
