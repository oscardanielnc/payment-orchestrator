# 0023. Base confirmations sized by time: 120 blocks for 0.2 s blocks

- Status: Accepted
- Date: 2026-10-22

## Context

ADR 0020 chose 12 confirmations for Base Sepolia, reasoning in time: 12 blocks of 2 s ≈ 24 s, enough
to ride out a sequencer reorg while a customer waits on the checkout. Recording the demo on
2026-10-22 showed a USDC deposit recorded 10 s after its block: Base Sepolia now makes a block
about every 0.2 s (971 blocks in 194 s). The same 12 blocks are now about 2.4 s, a tenth of the
safety margin the decision was about.

## Options considered

- Keep 12: fast, but the margin ADR 0020 argued for is gone
- Confirm by elapsed time (block timestamp older than N s): needs a second notion of finality next
  to the block cursor, and timestamps are set by the sequencer
- `safe` / `finalized` tags: still minutes, same objection as in ADR 0020
- **Keep counting blocks, size the default from the block time: 120 × 0.2 s ≈ 24 s**

## Decision

- `BASE_CONFIRMATIONS` defaults to 120; the variable stays, so an operator can follow the chain if
  its block time changes again
- First-run lookback grows from 300 to 1500 blocks (about 5 minutes), so it still reaches before
  the confirmed head

## Consequences

- A payment lands about 30 s after it is mined again (24 s + one poll), as the runbook said
- 2000 blocks per poll now cover about 7 minutes; a worker that was off for days catches up in
  more polls, which ADR 0020's `behind` loop already handles
- Block counts are a proxy for time: when a chain changes its block time, this default must follow
