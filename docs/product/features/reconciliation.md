# 15. Reconciliation

- Priority: P2
- Status: Done (verified live on 2026-10-13: Stripe test, Nile and Base Sepolia days matched; a real
  unread USDC transfer opened a finding that cleared once the watcher recorded it)

## Purpose

Detects mismatches between what providers report and what the ledger says.

## Rules

- Scheduled job per provider and network, over a time window
- Compares provider records (payments, on-chain transfers) with ledger transactions
- Mismatches are stored as findings: missing in ledger, missing at provider, amount differs
- Findings never auto-correct the ledger; a person decides

## Acceptance criteria

- [x] An injected mismatch appears as a finding with its type
- [x] A clean day produces zero findings
- [x] Running the job twice for the same window gives the same result

## Implementation

- Module `reconciliation` ([ADR 0021](../../adr/0021-reconciliation.md)): pure `compareRecords`, `Finding`
  (open → resolved | cleared), `RunReconciliationUseCase` (two-pass lookup), `ReconcilePreviousDayUseCase`
- Sources: Stripe (PaymentIntents list/retrieve) and one per chain (`tokenBalance` of deposit addresses);
  ledger side through `LedgerService.netDebits`
- Worker `ReconciliationSchedulerService` checks hourly; operator tool `recon:run [YYYY-MM-DD] [source]`
- API `GET /v1/reconciliation/findings`, `POST /v1/reconciliation/findings/:id/resolve` (owner);
  dashboard page **Reconciliation** with the shared `FilterPills`
- Tests: comparison and finding lifecycle (unit), use cases with fakes, e2e on fixed past days with
  a fake Stripe and a scripted chain (clean day, four injected mismatches, rerun, clearing)
- Runbook: [reconcile a day](../../runbooks/reconcile-a-day.md)

## Out of scope

Automatic corrections, settlement files.
