# 0020. Base Sepolia: 12 confirmations and a block-cursor log watcher

- Status: Accepted
- Date: 2026-10-09

## Context

Feature 13 adds USDC on Base Sepolia behind the same ports as TRON (ADR 0010). TRON has an explicit
"solidified" flag; Base (an OP Stack rollup, 2 s blocks) does not, so we must choose when a transfer
counts as paid, and how to read logs through a public RPC.

## Options considered

- `finalized` block tag: irreversible once the L1 batch is final, about 15-20 minutes. Too slow for a
  customer waiting on a checkout
- `safe` block tag: batch posted to L1, a few minutes; depends on RPC support
- 1 confirmation: a sequencer reorg would credit a payment that never happened
- **N blocks on top of the transfer, configurable (`BASE_CONFIRMATIONS`, default 12 ≈ 24 s)**

## Decision

- Read `Transfer` logs of the configured USDC contract only up to `head - BASE_CONFIRMATIONS`
- The cursor is the last block read; the next poll starts at cursor + 1 (no overlap needed: the blocks
  read are already confirmed). First run looks back 300 blocks
- `eth_getLogs` in 200-block requests (the public `sepolia.base.org` limit), 10 per poll to catch up
- The RPC's `eth_chainId` must be 84532 before the first read, on top of the env policy check
- `(txHash, logIndex)` is the transfer's identity; the log's `blockTimestamp` is used when the node
  sends it, so we do not fetch blocks for the many transfers that are not ours
- Addresses: BIP-44 coin type 60 (`m/44'/60'/0'/0/i`), EIP-55 checksummed, derived with viem

## Consequences

- A payment lands about 30 s after it is mined (12 blocks + one poll)
- A reorg deeper than 12 blocks would need reconciliation (feature 15); path to live: `finalized`
  for large amounts
- Domain, use cases and the ledger are untouched: Base is two adapters and configuration
