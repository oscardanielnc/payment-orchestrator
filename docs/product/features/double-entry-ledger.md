# 9. Double-entry ledger

- Priority: P0
- Status: Done (verified live on Nile on 2026-10-03)

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

- [x] A succeeded charge produces a balanced transaction
- [x] An unbalanced transaction fails at domain level
- [x] A merchant balance equals the sum of its entries (property test)
- [x] A duplicated confirmation does not create a second transaction

## Implementation

- Module `apps/api/src/modules/ledger/` (generic: accounts, transactions, entries, balances) exposing `LedgerService`
- Chart of accounts and postings in `payments/application/services/payment-postings.ts`:

```
confirmed transfer     Dr platform:<network>:deposits   Cr merchant:<org>:awaiting   (or :overpayments if already paid)
charge paid            Dr merchant:<org>:awaiting       Cr merchant:<org>:available  (+ Cr :overpayments for the excess)
```

- Posted in the same transaction as the transfer and the charge state change
- Endpoints (API key): `GET /v1/balances`, `GET /v1/charges/:id/ledger-entries`
- Tests: property test (trial balance zero for any sequence), e2e for exact / partial / over / extra payments,
  idempotency and the Postgres triggers

## Out of scope

Fees, payouts, FX conversion.
