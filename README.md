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
pnpm --filter @po/api db:deploy                  # apply migrations
pnpm --filter @po/api org:create "Acme Coffee"   # prints a test API key
pnpm dev                                         # API :3000/v1/health · dashboard :5173
```

`pnpm check` runs lint, typecheck, tests and build, the same as CI. E2E tests need Docker running.

## Layout

| Path                 | What                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| `apps/api`           | NestJS API and worker                                                  |
| `apps/web`           | Merchant dashboard (React, Vite, TanStack Query)                       |
| `packages/ui`        | Design system with Storybook                                           |
| `packages/contracts` | Zod request/response contracts shared by API and web                   |
| `packages/config`    | Shared TypeScript config                                               |
| `docs/`              | Vision, features, architecture, ADRs, design ([index](docs/README.md)) |
