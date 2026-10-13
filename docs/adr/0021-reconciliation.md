# 0021. Reconciliation: per-source daily windows, two-pass lookup, findings that never move money

- Status: Accepted
- Date: 2026-10-13

## Context

Feature 15: detect money a provider has and our ledger lacks (and the reverse). Webhooks get lost
(ADR 0019), watchers can fall behind, reorgs happen (ADR 0020). Something must compare both sides.

## Options considered

- Compare our own tables (attempts vs ledger): misses exactly what never reached us
- Re-read each chain's transfer history for the day: heavy on public RPCs (200-block log limits)
- Window filter on both sides only: a payment created 23:59 and recorded 00:01 becomes two findings
- **Per source and UTC day, each side read for the window, then the subjects the other side named
  looked up regardless of time**

## Decision

- `ReconciliationSource` port, one per enabled provider: Stripe (succeeded PaymentIntents carrying our
  attempt id vs net debits on `platform:stripe:receivable` per payment) and each chain (token balance
  of the charge's deposit addresses vs net debits on `platform:<network>:deposits` per charge).
  Deposits are never swept (ADR 0010), so on-chain balance = everything received
- Pure `compareRecords`: zero equals absent; kinds `missing_in_ledger`, `missing_at_provider`,
  `amount_mismatch`; different currencies never match
- A finding per `(source, subject)`: `open → resolved` (an owner, with a note) or `→ cleared` (a later
  run matched). A resolution stands only while the difference stays the same
- A run row per `(source, window)`, overwritten on rerun: same window, same findings
- The worker checks hourly and reconciles yesterday for sources without a run; `recon:run` runs any day
- Findings never post to the ledger. A correction is a separate, deliberate posting

## Consequences

- One `balanceOf` call per deposit address of the day: fine at testnet volume; a production version
  would batch with multicall or read an indexer
- A sweep of deposit addresses (path to live) would need sweep postings on the same account
- Merchants see findings about their own charges; ones without an organization stay internal
