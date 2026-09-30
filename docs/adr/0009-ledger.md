# 0009. Double-entry ledger schema

- Status: Accepted
- Date: 2026-09-28

## Context
Money movements must be auditable and self-checking.

## Decision
- `ledger_accounts` (id, organization_id, type, currency, code) — e.g. `merchant:<org>:available`, `crypto:tron:deposits`, `provider:stripe:receivable`
- `ledger_transactions` (id, idempotency reference, description, occurred_at)
- `ledger_entries` (transaction_id, account_id, direction debit/credit, amount NUMERIC(78,0))
- Domain rejects any transaction whose debits and credits differ per currency
- Append-only: no update/delete (enforced by repository API and a DB trigger); corrections by reversal
- Balances computed with `SUM`; snapshots later only if measurements require it

## Consequences
- Balances are always explainable by entries
- Reads of balances cost a sum; acceptable at MVP volume
