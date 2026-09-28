# Vision

> Status: Approved (2026-09-28).

## What it is

Payment Orchestrator is a payment platform for merchants. A merchant creates a
charge (through the API or a shareable payment link), its customer pays with the
method they prefer, and the system:

1. Picks the provider that handles that method
2. Receives the confirmation (provider webhook or on-chain transfer)
3. Reconciles what the provider reports against what was expected
4. Records every movement in a double-entry ledger

A web dashboard lets the merchant see charges, payments and balances.

## Who it is for

- **Merchants** that want one integration instead of one per provider
- **Their customers**, who pay by card, local wallet or stablecoin from a single checkout
- **Developers** integrating through a versioned REST API with API keys

## MVP scope

| Area | In the MVP |
|---|---|
| Tenancy | Organizations with members and API keys (minimal multi-merchant) |
| Card / local | Stripe (test mode), Mercado Pago (test credentials) |
| Crypto | USDT TRC-20 on TRON Nile testnet (priority), USDC on Base Sepolia |
| Crypto integration | Own integration, no intermediary processor: one port, one adapter per network (TronWeb for TRON, viem for EVM) |
| Money | Integers in the minor unit + currency code. USDT and USDC use 6 decimals |
| Channels | REST API, hosted payment link, merchant dashboard |

## What it is NOT

- **Not a real payment processor.** It never moves real money: test modes and testnets only. No live keys or mainnet, not even as examples
- **Not a wallet or custodian.** It does not hold, swap, bridge or pay out funds
- **Not an acquirer or PCI scope holder.** Card data never touches our servers; providers collect it
- **Not recurring billing (yet).** Installments, subscriptions and reminders are phase 2
- **Not every provider.** Culqi and Niubiz are phase 2; no other chains or tokens in the MVP
- **Not a commercial product.** It is an educational and portfolio project

## Principles

- **Test-only by policy, live-ready by design.** This repository only runs on test
  modes and testnets, enforced at startup by one environment policy. Going live must
  mean new configuration and a reviewed policy change, never a rewrite of the core
- The core does not know whether it runs in test or live, nor which network it is on:
  networks, token contracts and provider endpoints are configuration
- Every money movement is idempotent and recorded in an immutable double-entry ledger;
  balances are derived from entries, never stored and edited
- The server never holds keys that can spend crypto funds
- Providers are adapters behind ports; adding one does not touch the core

## Path to live (out of scope, designed for)

What a real deployment would add on top of this codebase:
key custody and fund sweeping (KMS/HSM), KYC/AML and legal compliance,
a secrets manager instead of `.env`, monitoring, alerting and incident runbooks.
