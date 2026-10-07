# Features

One file per feature: purpose, rules, acceptance criteria, out of scope.
Status: Proposed · Approved · In progress · Done.
Priority: P0 end-to-end path · P1 completes the MVP · P2 if time allows.

| #   | Feature                                               | Summary                                                      | Priority | Status   |
| --- | ----------------------------------------------------- | ------------------------------------------------------------ | -------- | -------- |
| 1   | [Environment guard](environment-guard.md)             | Refuses to boot on live credentials or mainnet               | P0       | Done     |
| 2   | [Organizations & API keys](organizations-api-keys.md) | Merchant tenancy and hashed, rotatable API keys              | P0       | Done     |
| 3   | [Dashboard auth](dashboard-auth.md)                   | Login for dashboard users with rotating refresh tokens       | P0       | Done     |
| 4   | [Charges API](charges-api.md)                         | Create and query charges idempotently, with a state machine  | P0       | Done     |
| 5   | [Provider routing](provider-routing.md)               | Chooses the provider for a charge's method and currency      | P0       | Done     |
| 6   | [Webhook ingestion](webhook-ingestion.md)             | Verify, store raw, ack fast, process idempotently in a queue | P0       | Done     |
| 7   | [Stripe adapter](stripe-adapter.md)                   | Card payments through Stripe test mode                       | P0       | Done     |
| 8   | [USDT on TRON Nile](tron-usdt.md)                     | Own on-chain integration for USDT TRC-20 on the Nile testnet | P0       | Done     |
| 9   | [Double-entry ledger](double-entry-ledger.md)         | Immutable debit/credit entries; balances are derived         | P0       | Done     |
| 10  | [Merchant dashboard](merchant-dashboard.md)           | Web panel: charges, balances and API keys                    | P0       | Done     |
| 11  | [Payment links & checkout](payment-links-checkout.md) | Shareable link to a hosted checkout                          | P1       | Done     |
| 12  | [Mercado Pago adapter](mercadopago-adapter.md)        | Local payments through Mercado Pago test credentials         | P1       | Approved |
| 13  | [USDC on Base Sepolia](base-usdc.md)                  | Own on-chain integration for USDC on Base Sepolia            | P1       | Approved |
| 14  | [Outbound webhooks](outbound-webhooks.md)             | Notify merchants of charge events, signed and retried        | P1       | Approved |
| 15  | [Reconciliation](reconciliation.md)                   | Daily comparison of providers vs ledger                      | P2       | Approved |

## Build order

```
1 → 2 → 4 → 5 → 8 → 6 → 9 → 3 → 10
                     └─ 7 (reuses 6 and 9)
then P1: 11, 12, 13, 14 · P2: 15
```
