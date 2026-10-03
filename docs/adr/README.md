# Architecture Decision Records

One decision per file (`NNNN-slug.md`, max 40 lines). Discarded attempts are recorded too, so nobody tries them again.
Template: [template.md](template.md).

| #                                                  | Title                                                                       | Status   |
| -------------------------------------------------- | --------------------------------------------------------------------------- | -------- |
| [0001](0001-monorepo.md)                           | Monorepo with Turborepo and pnpm                                            | Accepted |
| [0002](0002-hexagonal-modules.md)                  | Hexagonal modules with abstract-class ports                                 | Accepted |
| [0003](0003-api-and-worker.md)                     | One codebase, two processes: API and worker                                 | Accepted |
| [0004](0004-unit-of-work.md)                       | Cross-module transactions with a unit of work                               | Accepted |
| [0005](0005-money.md)                              | Money as integer minor units                                                | Accepted |
| [0006](0006-environment-policy.md)                 | Environment policy: test-only by policy, live-ready by design               | Accepted |
| [0007](0007-idempotency.md)                        | Idempotency keys stored in Postgres                                         | Accepted |
| [0008](0008-outbox-and-queues.md)                  | Outbox, BullMQ queues and inbound webhook pipeline                          | Accepted |
| [0009](0009-ledger.md)                             | Double-entry ledger schema                                                  | Accepted |
| [0010](0010-crypto-deposits.md)                    | Crypto deposits: xpub-derived addresses and polling watchers                | Accepted |
| [0011](0011-auth.md)                               | Authentication: dashboard sessions and API keys                             | Accepted |
| [0012](0012-checkout-status.md)                    | Checkout status updates by polling                                          | Accepted |
| [0013](0013-toolchain-versions.md)                 | Toolchain versions follow ecosystem compatibility, not "latest"             | Accepted |
| [0014](0014-charges-concurrency-and-pagination.md) | Charges: optimistic locking and keyset pagination                           | Accepted |
| [0015](0015-payment-providers-and-routing.md)      | Payment providers: one port, an enabled-providers registry, routing as data | Accepted |
| [0016](0016-card-declines-keep-charges-open.md)    | A card decline does not close the charge                                    | Accepted |
