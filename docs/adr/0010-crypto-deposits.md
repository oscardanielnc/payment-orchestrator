# 0010. Crypto deposits: xpub-derived addresses and polling watchers

- Status: Accepted (revised 2026-10-01 with the TRON implementation)
- Date: 2026-09-28

## Context

Each payment attempt needs a unique address. The server must not be able to spend funds.

## Decision

- One account-level xpub per network (TRON: `m/44'/195'/0'`; EVM: coin type 60), generated offline for testnets
- Address `i` = `xpub/0/i`, derived with `@scure/bip32`; TRON encoding (keccak256 → `0x41` → base58check) with
  `@noble/hashes` and `@scure/base`, verified in tests against TronWeb's own derivation. EVM will use viem
- One address per **attempt**; the index comes from a Postgres sequence per network (never reused)
- Watchers poll on an interval with a persisted cursor:
  - TRON: TronGrid contract events, `only_confirmed=true` (solidified, irreversible). The cursor is the newest
    block timestamp read; each poll re-reads one minute before it in case the indexer was late
  - EVM: viem `getLogs` for `Transfer` of the USDC contract, up to `head - confirmations` (details in ADR 0020)
- `(network, txHash, eventIndex)` is unique: re-reading is harmless
- Each transfer is applied in its own transaction (record, credit deposit, settle attempt and charge).
  Until feature 6 adds queues, the worker calls the use case directly; network I/O stays outside transactions

## Consequences

- Sweeping funds needs the private key offline (out of scope, "Path to live")
- Polling adds about a minute on TRON (solidification) plus the interval; acceptable for the MVP
- A transfer that arrives after the charge closed is recorded on its deposit and left for reconciliation
