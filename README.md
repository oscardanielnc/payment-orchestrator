# Payment Orchestrator

Payment platform for merchants: one API and a hosted payment link, routed to Stripe, Mercado Pago,
USDT on TRON or USDC on Base, confirmed by webhook or on-chain, and recorded in a double-entry ledger.

**Test mode and testnets only.** The app refuses to start with live credentials or a mainnet network.

## Run it

Requirements: Node 24, pnpm, Docker.

```sh
pnpm install
cp .env.example .env
docker compose up -d
pnpm dev                # API on http://localhost:3000/v1/health
```

`pnpm check` runs lint, typecheck, tests and build, the same as CI.

## Layout

| Path              | What                                                                   |
| ----------------- | ---------------------------------------------------------------------- |
| `apps/api`        | NestJS API and worker                                                  |
| `packages/config` | Shared TypeScript config                                               |
| `docs/`           | Vision, features, architecture, ADRs, design ([index](docs/README.md)) |
