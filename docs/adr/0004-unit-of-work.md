# 0004. Cross-module transactions with a unit of work

- Status: Accepted
- Date: 2026-09-28

## Context
Confirming a payment changes the charge, writes ledger entries and an outbox event.
All three must commit or none. They live in different modules.

## Options considered
- Pass a Prisma transaction client through every call: leaks infrastructure into use cases
- Eventual consistency between charge and ledger: a crash could leave a paid charge with no ledger entry
- **Unit of work via async context**

## Decision
`@nestjs-cls/transactional` with its Prisma adapter. A use case marks the boundary;
every repository inside it transparently uses the same transaction.
Only the use case decides where a transaction starts.

## Consequences
- Use cases stay free of Prisma types
- Everything inside one unit of work must use the same database
