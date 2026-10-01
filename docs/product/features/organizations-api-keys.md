# 2. Organizations & API keys

- Priority: P0
- Status: Done (members and owner-only key management moved to [feature 3](dashboard-auth.md))

## Purpose

Minimal multi-merchant support: every resource belongs to one organization, and
integrations authenticate with API keys.

## Rules

- Every charge, link, account and key belongs to exactly one organization; queries are always scoped by it
- API key format: `po_<environment>_<keyId>_<secret>`. `keyId` is 12 base62 characters (public, indexed);
  `secret` is 32 random bytes in base64url. The full token is shown **once** at creation
- Only a SHA-256 hash of the secret is stored; lookup by `keyId`, constant-time comparison (ADR 0011)
- A token from another environment tag is rejected
- Malformed, unknown, revoked and wrong-secret keys get the same error (`api_key.invalid`), so callers cannot probe which keys exist
- Keys can be revoked; a revoked key fails immediately. Revoking another organization's key looks like "not found"
- `last_used_at` is recorded on each successful authentication
- An organization is created together with its first key in one transaction (ADR 0004)

## Acceptance criteria

- [x] Creating a key returns the full secret once; later reads show only the prefix
- [x] A request with a valid key is scoped to its organization
- [x] A revoked or malformed key gets `401` in Problem Details format
- [x] Organization A can never read or modify organization B's resources (tested)

## Implementation

- Module `apps/api/src/modules/identity/` (first hexagonal module; layers enforced by ESLint)
- Endpoints (API key auth): `GET /v1/organization`, `GET /v1/api-keys`
- Local bootstrap until the dashboard exists: `pnpm --filter @po/api org:create "<name>"` prints the first key
- Tests: domain and use cases with in-memory fakes; e2e against a Testcontainers Postgres, including a rollback test for the unit of work

## Moved to feature 3

Members with `owner` / `member` roles, and owner-only endpoints to issue and revoke keys
(they need a signed-in dashboard user).

## Out of scope

Invitations by email, fine-grained permissions, SSO.
