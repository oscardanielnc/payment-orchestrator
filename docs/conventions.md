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

| Command                                     | What it does                                                         |
| ------------------------------------------- | -------------------------------------------------------------------- |
| `docker compose up -d`                      | Starts Postgres and Redis                                            |
| `pnpm dev`                                  | Runs every app in watch mode                                         |
| `pnpm check`                                | lint → typecheck → test → build (same as CI)                         |
| `pnpm --filter @po/api test:watch`          | API tests in watch mode                                              |
| `pnpm --filter @po/api db:migrate`          | Creates and applies a migration after editing `prisma/schema.prisma` |
| `pnpm --filter @po/api org:create "<name>"` | Creates an organization and prints its first API key                 |

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
