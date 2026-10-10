# 13. USDC on Base Sepolia

- Priority: P1
- Status: In progress (code done and reading the live chain; live payment pending a funded test payer)

## Purpose

Second network behind the same `BlockchainWatcher` port, using viem.

## Rules

- Same rules as [USDT on TRON Nile](tron-usdt.md): per-charge address from an extended public key, exact/under/over payment handling, no transaction applied twice
- Detects ERC-20 `Transfer` logs of the configured USDC contract
- Confirmed after `BASE_CONFIRMATIONS` blocks, default 12 ([ADR 0020](../../adr/0020-base-confirmations-and-evm-watcher.md))
- Chain id 84532 enforced by the environment guard and checked against the RPC; only Circle's test USDC contract is accepted

## Acceptance criteria

- [ ] Test USDC sent on Base Sepolia moves the charge to `succeeded` after confirmations
- [x] Domain and use cases are unchanged versus the TRON feature (the diff touches adapters, config and wiring only)

## Implementation

- `crypto/infrastructure/evm/`: `EvmXpubAddressDeriver` (`m/44'/60'/0'/0/i`, compared with viem's
  `mnemonicToAccount`), `EvmTransferSource` (block cursor, confirmations, 200-block `eth_getLogs` ranges)
  over `viemChainReader`
- Registered in `crypto.module.ts` and `payments.module.ts` when `BASE_*` config is complete; the watcher
  polls each network at its own `pollIntervalMs`
- Dev tools: `crypto:xpub base`, `base:payer new | balance | pay`; secrets go to the private wallets file
- Tests: derivation vs viem, source ranges/confirmations/chain check with a fake RPC, e2e with the real
  source over a scripted chain (confirmations, exact, partial, ledger)
- Runbook: [test a payment on Base](../../runbooks/test-a-payment-on-base.md)

## Out of scope

Other EVM chains, native ETH payments, gas management.
