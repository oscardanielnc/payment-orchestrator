# 0009. Double-entry ledger schema

- Status: Accepted (revised 2026-10-03 with the implementation)
- Date: 2026-09-28

## Context

Money movements must be auditable and self-checking. Model taken from Modern Treasury's Ledgers.

## Decision

- `ledger_accounts` (code, currency, name, `normal_balance` debit|credit, organization or null for platform);
  created on first use; `(code, currency)` unique
- `ledger_transactions` (`external_id` unique, reference, description, status pending|posted|archived)
- `ledger_entries` (transaction, account, direction, amount `NUMERIC(78,0)` > 0, currency)
- The domain rejects any transaction whose debits and credits differ per currency, or with < 2 entries
- Append-only, enforced twice: repository API (insert only) and Postgres triggers (entries: no UPDATE/DELETE;
  transactions: no DELETE, no change once not pending). Corrections are reversing transactions
- `external_id` makes posting idempotent: one business event → one transaction
- Balances are `SUM`s over entries, signed by the account's normal balance; `posted` and `posted + pending`
- The ledger module is generic; the payments module owns the chart of accounts and what each event posts:
  `platform:<network>:deposits` (asset), `merchant:<org>:awaiting | available | overpayments` (liabilities)

## Consequences

- Balances are always explainable by entries, and the trial balance is zero by construction (property-tested)
- Reads of balances cost a sum; snapshots only if measurements require it
- Payments made before the ledger existed (2026-10-03) have no entries; reconciliation will flag them
