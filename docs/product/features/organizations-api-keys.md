# 2. Organizations & API keys

- Priority: P0
- Status: Approved

## Purpose

Minimal multi-merchant support: every resource belongs to one organization, and
integrations authenticate with API keys.

## Rules

- An organization has members (dashboard users) with a role: `owner` or `member`
- Every charge, link, account and key belongs to exactly one organization; queries are always scoped by it
- API key format: visible prefix + secret, e.g. `po_test_<id>_<secret>`. Shown **once** at creation
- Only a hash of the secret is stored; lookup by the visible id, constant-time comparison
- Keys can be revoked and rotated; a revoked key fails immediately
- `last_used_at` is recorded for each key
- Only `owner` can create or revoke keys

## Acceptance criteria

- [ ] Creating a key returns the full secret once; later reads show only the prefix
- [ ] A request with a valid key is scoped to its organization
- [ ] A revoked or malformed key gets `401` in Problem Details format
- [ ] Organization A can never read or modify organization B's resources (tested)

## Out of scope

Invitations by email, fine-grained permissions, SSO.
