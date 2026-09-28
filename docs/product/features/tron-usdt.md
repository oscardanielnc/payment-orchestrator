# 8. USDT on TRON Nile

- Priority: P0
- Status: Approved

## Purpose

Priority crypto rail, built without an intermediary processor.

## Rules

- One deposit address per charge, derived from an extended public key (the server never holds spending keys)
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

- [ ] Test USDT sent on Nile to the charge address moves it to `succeeded` after solidification
- [ ] Underpayment and overpayment follow the rules above (tested with fakes)
- [ ] Restarting the watcher neither misses nor double-counts transfers (it resumes from a stored cursor)

## Out of scope

Sweeping funds, TRX energy/bandwidth management, mainnet.
