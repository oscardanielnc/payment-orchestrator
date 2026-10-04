# 3. Dashboard auth

- Priority: P0
- Status: Done (verified live on 2026-10-04)

## Purpose

Lets merchant members sign in to the dashboard securely.

## Rules

- Email + password; argon2id with OWASP parameters ([ADR 0011](../../adr/0011-auth.md)); 12–128 characters
- Short-lived access token (JWT, ~15 min) + refresh token in an `httpOnly`, `Secure`, `SameSite` cookie
- Refresh tokens **rotate** on every use; reusing an old one revokes the whole session family
- Tokens are never stored in `localStorage`
- Login endpoint is rate limited
- One guard accepts either an API key or a dashboard token; endpoints that manage credentials also require a signed-in `owner` (API keys never qualify)
- Users are members of an organization with a role: `owner` or `member` (moved here from feature 2)
- Only `owner` can issue and revoke API keys: `POST /v1/api-keys`, `DELETE /v1/api-keys/:id` (use cases already exist in `identity`)

## Acceptance criteria

- [x] Valid login sets the refresh cookie and returns an access token
- [x] Wrong credentials return the same error whether the email exists or not
- [x] A reused refresh token is rejected and its session family revoked
- [x] Logout invalidates the refresh token
- [x] A `member` gets `403` when issuing or revoking a key; an `owner` succeeds

## Implementation

- `identity` module: `LoginUseCase`, `RefreshSessionUseCase` (rotation + reuse detection), `LogoutUseCase`, `CreateUserUseCase`
- Endpoints: `POST /v1/auth/login`, `POST /v1/auth/refresh`, `POST /v1/auth/logout`, `GET /v1/auth/me`,
  `POST /v1/api-keys` and `DELETE /v1/api-keys/:id` (owner only)
- `MerchantAuthGuard` accepts an API key or an access token on every merchant endpoint, so the dashboard reads
  charges, balances and ledger entries with the same API
- `configure-app.ts`: helmet, cookie parser, CORS allow-list (`DASHBOARD_ORIGINS`), shared by `main.ts` and tests
- Users are created with `pnpm --filter @po/api user:create <org id> <email> [owner|member]` until invitations exist

## Out of scope

Sign-up with email verification, password reset, 2FA.
