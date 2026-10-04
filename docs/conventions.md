# Conventions

Rules the linter cannot enforce.

## Money

- Amounts are integers in the currency's minor unit plus a currency code. Never floats.
- Decimals per currency: USD 2, PEN 2, USDT 6, USDC 6.

## Safety

- Test mode and testnets only. Live keys and mainnet endpoints are never used, not even as examples.
- No secrets in git. `.env.example` stays current.

## Git

- Conventional Commits. Short branches, PRs to `main`.
- Docs change in the same PR as the code that affects them.

## Commands

| Command                                                              | What it does                                                         |
| -------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `docker compose up -d`                                               | Starts Postgres and Redis                                            |
| `pnpm dev`                                                           | Runs every app in watch mode                                         |
| `pnpm check`                                                         | lint → typecheck → test → build (same as CI)                         |
| `pnpm --filter @po/api test:watch`                                   | API tests in watch mode                                              |
| `pnpm --filter @po/api db:migrate`                                   | Creates and applies a migration after editing `prisma/schema.prisma` |
| `pnpm --filter @po/api org:create "<name>"`                          | Creates an organization and prints its first API key                 |
| `pnpm --filter @po/api user:create <org id> <email> [owner\|member]` | Creates a dashboard user and prints a generated password once        |
| `pnpm --filter @po/api dev:worker`                                   | Runs the worker (chain watchers) in watch mode                       |
| `pnpm --filter @po/api crypto:xpub`                                  | Creates a testnet deposit wallet and prints its xpub                 |
| `pnpm --filter @po/api tron:payer …`                                 | Testnet customer wallet: `new`, `balance`, `pay <addr> <units>`      |
| `pnpm --filter @po/api demo:tron [units]`                            | Whole USDT flow on Nile in one command (needs a funded payer)        |
| `pnpm --filter @po/api stripe:pay <pi> [visa\|declined\|cancel]`     | Plays the card customer in Stripe test mode                          |
| `pnpm --filter @po/ui storybook`                                     | Design system in Storybook on http://localhost:6006                  |

## Testing

- Unit tests (`src/**/*.spec.ts`) use in-memory fakes of the ports; no database
- E2E tests (`test/**/*.e2e-spec.ts`) boot the real app against a Testcontainers Postgres: Docker must be running
- Test fixtures that look like secrets carry an inline `gitleaks:allow` comment explaining why

## Errors

- Domain errors extend `DomainError` with a stable `code` (`<entity>.<problem>`)
- HTTP statuses are mapped only in `ProblemDetailsFilter`; responses follow RFC 9457 with `code`

## API

- Request and response shapes live in `packages/contracts` (Zod); controllers validate with `ZodValidationPipe`
- Money is a string of minor units in JSON, `bigint` in code, `NUMERIC(78,0)` in Postgres
- Endpoints that create or move money use `IdempotencyInterceptor` and therefore require `Idempotency-Key`
- Lists use keyset pagination: `?limit=&cursor=` → `{ data, nextCursor }`

## Database

- Constraints Prisma cannot express (partial unique indexes) are appended by hand to the migration SQL,
  created with `prisma migrate dev --create-only`. Review later generated migrations so they never drop them
- `prisma migrate dev` no longer regenerates the client in Prisma 7: `db:migrate` runs `prisma generate` after it

## Frontend

- Server data goes through TanStack Query; Zustand holds only the session. Never put tokens in localStorage
- Components come from `packages/ui` and cover empty, loading and error states; UI copy in English

## Code layout

- `src/tools/` holds developer tools (testnet wallets, payer); they are outside the layered modules on purpose
- DI constructor parameters are written as full class types, never type aliases: SWC emits decorator metadata
  from the written type, and an alias becomes `Object`

## Ledger

- Every money movement posts through `LedgerService.post` inside the same unit of work as the state change
- Each post has an `externalId` derived from the business event (`chain-transfer:…`, `charge-settled:<id>`)
- Never update or delete ledger rows (triggers will refuse); post a reversal with `reversalEntries()`

## Queues

- Enqueue after the transaction commits, never inside it (the job may run before the row is visible)
- Every job has a deterministic `jobId` (no `:`); handlers are idempotent because delivery is at-least-once
- Consumers (`@Processor`) are registered only in the worker; the API only produces
- New inbound providers add a `WebhookVerifier` to `WEBHOOK_VERIFIERS` and an `InboundEventHandler` to the
  handlers their module exports

## Auth

- Merchant endpoints use `@UseGuards(MerchantAuthGuard)` (API key or dashboard token); read the caller with
  `@CurrentOrganization()` or `@CurrentPrincipal()`
- Anything that manages credentials or members adds `RolesGuard` + `@Roles('owner')`: API keys never pass it
- The refresh token only ever lives in the `po_refresh` cookie; never return it in a body or log it
