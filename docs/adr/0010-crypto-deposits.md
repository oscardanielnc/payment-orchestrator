# 0010. Crypto deposits: xpub-derived addresses and polling watchers

- Status: Accepted
- Date: 2026-09-28

## Context
Each charge needs a unique address. The server must not be able to spend funds.

## Decision
- One account-level xpub per network (TRON coin type 195, EVM coin type 60), generated offline for testnets
- Address `i` = child `i` of the xpub, derived with `@scure/bip32`; TRON encodes it with TronWeb utilities, EVM with viem
- The derivation index is allocated with a DB sequence; address ↔ charge stored with a unique constraint
- Watchers poll on an interval with a persisted cursor:
  - TRON: TronGrid events of the USDT contract, confirmed (solidified) only
  - EVM: viem `getLogs` for `Transfer` of the USDC contract, up to `head - confirmations`
- Detected transfers are enqueued like webhooks; tx hash + log index is unique

## Consequences
- Sweeping funds needs the private key offline (out of scope, "Path to live")
- Polling adds seconds of latency; acceptable versus websocket reconnection complexity
