# 0001. Monorepo with Turborepo and pnpm

- Status: Accepted
- Date: 2026-09-28

## Context
API and dashboard share request/response types. Duplicating them drifts.

## Options considered
- Two repositories + OpenAPI codegen: realistic for companies, more ceremony for one person
- **Monorepo with `packages/contracts`**: one definition, imported by both

## Decision
Turborepo + pnpm workspaces: `apps/api`, `apps/web`, `packages/contracts`, `packages/ui`, `packages/config`.
The public checkout is a route of `apps/web`, split into its own bundle.

## Consequences
- A contract change breaks the build on both sides immediately
- Turborepo caches lint/test/build per package
- If the checkout ever needs its own domain or stricter isolation, it moves to `apps/checkout`
