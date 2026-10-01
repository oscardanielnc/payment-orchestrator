# 0002. Hexagonal modules with abstract-class ports

- Status: Accepted
- Date: 2026-09-28

## Context

Providers and networks will be added and swapped (and maybe used with real money later).
The business rules must not depend on any SDK, ORM or framework.

## Options considered

- Layered MVC (controller → service → ORM): fast start, providers leak into services
- **Hexagonal per module**: domain + use cases isolated, adapters at the edge

## Decision

Each module: `domain/`, `application/{ports,use-cases}/`, `infrastructure/`, `presentation/`.
Ports are **abstract classes**, used as Nest DI tokens (TypeScript interfaces vanish at runtime).
Dependency direction enforced with `eslint-plugin-boundaries`; the Prisma client is importable only from `infrastructure/`.

## Consequences

- Use cases are tested with fakes, in milliseconds
- Adding a provider = one adapter + one provider binding
- More files and mappers than a CRUD app; accepted as the cost of isolation
