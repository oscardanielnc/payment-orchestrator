# 3. Dashboard auth

- Priority: P0
- Status: Approved

## Purpose

Lets merchant members sign in to the dashboard securely.

## Rules

- Email + password; password stored with a slow hash (algorithm decided in an ADR)
- Short-lived access token (JWT, ~15 min) + refresh token in an `httpOnly`, `Secure`, `SameSite` cookie
- Refresh tokens **rotate** on every use; reusing an old one revokes the whole session family
- Tokens are never stored in `localStorage`
- Login endpoint is rate limited
- Dashboard auth and API key auth are separate guards; each endpoint declares which one it accepts
- Users are members of an organization with a role: `owner` or `member` (moved here from feature 2)
- Only `owner` can issue and revoke API keys: `POST /v1/api-keys`, `DELETE /v1/api-keys/:id` (use cases already exist in `identity`)

## Acceptance criteria

- [ ] Valid login sets the refresh cookie and returns an access token
- [ ] Wrong credentials return the same error whether the email exists or not
- [ ] A reused refresh token is rejected and its session family revoked
- [ ] Logout invalidates the refresh token
- [ ] A `member` gets `403` when issuing or revoking a key; an `owner` succeeds

## Out of scope

Sign-up with email verification, password reset, 2FA.
