# 8. USDT on TRON Nile

- Priority: P0
- Status: Done (verified live on Nile on 2026-10-03: 1 USDT charge paid from the test payer wallet)

## Purpose

Priority crypto rail, built without an intermediary processor.

## Rules

- One deposit address per payment attempt, derived from an extended public key (the server never holds spending keys)
- A watcher detects TRC-20 `Transfer` events of the configured USDT contract to active deposit addresses
- A payment counts only once its block is **solidified** (irreversible on TRON)
- Amount matching in integers with 6 decimals:
  - exact → `succeeded`
  - less → stays `pending` and records the partial amount; `expired` if not completed in time
  - more → `succeeded`, and the excess is recorded as an overpayment in the ledger
- The same transaction hash is never applied twice
- Network host and contract come from configuration (checked by the environment guard)
- Implemented with TronWeb behind a `BlockchainWatcher` port

## Acceptance criteria

- [x] Test USDT sent on Nile to the charge address moves it to `succeeded` after solidification
- [x] Underpayment and overpayment follow the rules above (tested with fakes)
- [x] Restarting the watcher neither misses nor double-counts transfers (it resumes from a stored cursor)

## Implementation

- Module `apps/api/src/modules/crypto/`: chain mechanics only (derivation, TronGrid reader, deposits, transfers, cursor)
- `payments` drives it: `CryptoDepositProvider` (registered when TRON config is complete) and `ProcessChainTransfersUseCase`
- Worker process `src/worker.ts` polls every `TRON_POLL_INTERVAL_MS`
- Dev tools: `crypto:xpub`, `tron:payer new | balance | pay` — see [the runbook](../../runbooks/test-a-payment-on-nile.md)
- Tests: derivation compared with TronWeb; TronGrid parsing with a real response shape; e2e of exact, partial,
  overpaid, duplicated and foreign transfers against Postgres

## Out of scope

Sweeping funds, TRX energy/bandwidth management, mainnet.
