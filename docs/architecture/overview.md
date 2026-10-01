# Architecture overview

> Status: Approved (2026-09-30).

## Shape

Turborepo + pnpm monorepo ([ADR 0001](../adr/0001-monorepo.md)).

```
apps/
  api/        NestJS. Two entrypoints over one codebase (ADR 0003):
              main.ts   → HTTP API
              worker.ts → queue consumers, chain watchers, outbox relay, schedulers
  web/        React + Vite. Merchant dashboard + public checkout (/pay/:id)
packages/
  contracts/  Zod schemas + types of the API. Single source of truth
  ui/         Component system + Storybook
  config/     Shared eslint, tsconfig, prettier
```

Runtime (local and prod): Postgres + Redis via Docker Compose.

## Backend modules

Every module is hexagonal ([ADR 0002](../adr/0002-hexagonal-modules.md)):
`domain → application (use cases + ports) → infrastructure / presentation`.

| Module           | Owns                                                                                           | Main ports                                             |
| ---------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `shared`         | `Money`, `Currency`, ids, domain errors, `Clock`, outbox, unit of work                         | `Clock`, `IdGenerator`, `OutboxWriter`                 |
| `config`         | Environment schema + payments policy ([ADR 0006](../adr/0006-environment-policy.md))           | —                                                      |
| `identity`       | Users, organizations, members, sessions, API keys                                              | `UserRepository`, `ApiKeyRepository`, `PasswordHasher` |
| `charges`        | Charges, payment attempts, state machine, idempotency                                          | `ChargeRepository`, `IdempotencyStore`                 |
| `payments`       | Payment attempts, routing table, provider registry; card/local adapters (Stripe, Mercado Pago) | `PaymentProvider`                                      |
| `crypto`         | Deposit addresses, chain watchers (TRON, EVM); its adapters also implement `PaymentProvider`   | `AddressDeriver`, `BlockchainWatcher`                  |
| `inbound`        | Webhook ingestion: verify, store raw, enqueue                                                  | `WebhookVerifier`, `RawEventStore`                     |
| `ledger`         | Accounts, entries, balances                                                                    | `LedgerRepository`                                     |
| `notifications`  | Outbound merchant webhooks                                                                     | `WebhookSender`                                        |
| `reconciliation` | Provider vs ledger findings                                                                    | `ProviderStatement`                                    |

### Rules between modules

- A module talks to another only through its **public API** (an exported application service), never its repositories or entities
- Anything that must be atomic (charge state + ledger + outbox) runs inside one **unit of work** ([ADR 0004](../adr/0004-unit-of-work.md))
- Anything that can be eventual goes through the **outbox** ([ADR 0008](../adr/0008-outbox-and-queues.md))
- Enforced with `eslint-plugin-boundaries` in CI

## Main flow: charge → confirmation → ledger

```
Merchant ── POST /v1/charges (Idempotency-Key) ──▶ charges: CreateCharge
                                                     │ tx: charge + idempotency record
Customer ── picks method ──▶ charges: StartAttempt ──▶ payments/crypto: route
                                 ├─ card/local: PaymentProvider.createPayment()
                                 └─ crypto:     AddressDeriver.next() → deposit address

Confirmation arrives
  Stripe/MP ── webhook ──▶ inbound: verify → store raw → 202 → queue
  TRON/EVM  ── watcher  ──▶ solidified/confirmed transfer → queue
                                            │
                                            ▼  (worker)
                    charges: ConfirmPayment  ─── one unit of work ───
                      ├─ charge.markSucceeded()      (domain rule)
                      ├─ ledger.post(balanced tx)    (public API)
                      └─ outbox: charge.succeeded
                                            │
                                  outbox relay ──▶ notifications ──▶ merchant endpoint
```

## Data

- Postgres via Prisma 7; the generated client never leaves `infrastructure/`
- Migrations versioned in the repo; SQL log on in development
- Money: `BigInt` + currency code, `NUMERIC(78,0)` ([ADR 0005](../adr/0005-money.md))
- Ledger schema in [ADR 0009](../adr/0009-ledger.md)

## HTTP

- `/v1/` prefix, Zod validation (`nestjs-zod`), OpenAPI generated from the contracts
- Errors: one global filter → RFC 9457 Problem Details with a stable `code`
- Auth: dashboard (JWT + rotating refresh cookie) and API keys, separate guards ([ADR 0011](../adr/0011-auth.md))
- `helmet`, `@nestjs/throttler`, CORS allow-list, `nestjs-pino` logs with redaction

## Crypto

- Deposit addresses derived from an xpub; no spending keys on the server ([ADR 0010](../adr/0010-crypto-deposits.md))
- Watchers (worker process) poll with a stored cursor, only confirmed data; each transfer settles in its own transaction (queue added with feature 6)

## Frontend

- Bulletproof React by feature: `auth`, `charges`, `balances`, `api-keys`, `checkout`
- TanStack Query for server data; checkout status by polling ([ADR 0012](../adr/0012-checkout-status.md))
- Routes split per area so the public checkout never loads dashboard code

## Testing

| Layer              | Tool                                                                 |
| ------------------ | -------------------------------------------------------------------- |
| Domain + use cases | Vitest with fake ports                                               |
| Adapters + API     | Vitest + supertest + Testcontainers (Postgres, Redis)                |
| Components         | Testing Library + Storybook stories                                  |
| Critical flows     | Playwright (create charge → pay on Nile → dashboard shows succeeded) |

## Pending decisions (decided when their feature starts)

- Mercado Pago production-credential detection (feature 12)
- Confirmation depth on Base Sepolia (feature 13)
