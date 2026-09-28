# 9. Double-entry ledger

- Priority: P0
- Status: Approved

## Purpose

Single source of truth for money. Every confirmed movement is auditable.

## Rules

- Tables: accounts (owner, type, currency) and entries (account, amount, direction, transaction)
- Every ledger transaction balances to zero **per currency**; unbalanced writes are rejected by the domain
- Entries are immutable: no update, no delete. Corrections are reversing entries
- Balances are computed from entries (snapshots only as an optimization, never as the source)
- Ledger writes happen in the same database transaction as the charge state change
- Amounts: `BigInt` in code, `NUMERIC(78,0)` in Postgres

## Acceptance criteria

- [ ] A succeeded charge produces a balanced transaction
- [ ] An unbalanced transaction fails at domain level
- [ ] A merchant balance equals the sum of its entries (property test)
- [ ] A duplicated confirmation does not create a second transaction

## Out of scope

Fees, payouts, FX conversion.
