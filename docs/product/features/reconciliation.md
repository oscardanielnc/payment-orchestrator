# 15. Reconciliation

- Priority: P2
- Status: Approved

## Purpose

Detects mismatches between what providers report and what the ledger says.

## Rules

- Scheduled job per provider and network, over a time window
- Compares provider records (payments, on-chain transfers) with ledger transactions
- Mismatches are stored as findings: missing in ledger, missing at provider, amount differs
- Findings never auto-correct the ledger; a person decides

## Acceptance criteria

- [ ] An injected mismatch appears as a finding with its type
- [ ] A clean day produces zero findings
- [ ] Running the job twice for the same window gives the same result

## Out of scope

Automatic corrections, settlement files.
