# 13. USDC on Base Sepolia

- Priority: P1
- Status: Approved

## Purpose

Second network behind the same `BlockchainWatcher` port, using viem.

## Rules

- Same rules as [USDT on TRON Nile](tron-usdt.md): per-charge address from an extended public key, exact/under/over payment handling, no transaction applied twice
- Detects ERC-20 `Transfer` logs of the configured USDC contract
- Confirmed after a configurable number of blocks (value decided in an ADR)
- Chain id 84532 enforced by the environment guard

## Acceptance criteria

- [ ] Test USDC sent on Base Sepolia moves the charge to `succeeded` after confirmations
- [ ] Domain and use cases are unchanged versus the TRON feature

## Out of scope

Other EVM chains, native ETH payments, gas management.
