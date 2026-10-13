# Reconcile a day

The worker reconciles yesterday (UTC) on its own every hour until each source has a run. Use this
to check any day by hand, or to see a finding appear and clear.

## Run it

```sh
pnpm --filter @po/api recon:run                      # today, every enabled source
pnpm --filter @po/api recon:run 2026-10-13           # one UTC day
pnpm --filter @po/api recon:run 2026-10-13 stripe    # one source: stripe | tron-nile | base-sepolia
```

Each line reads `matched · findings · new`. Running a day again gives the same findings.

## See a finding live (Base Sepolia)

1. Stop the worker, then send 0.1 USDC to an address that was already paid today:
   `pnpm --filter @po/api base:payer pay <address> 100000`
2. `recon:run <today> base-sepolia` → **1 finding**: `amount_mismatch` (chain 1.1, ledger 1.0)
3. Start the worker; it reads the transfer as an overpayment
4. `recon:run <today> base-sepolia` again → the finding is **cleared**

## Reading findings

| Kind                  | Means                                       | Usual cause                           |
| --------------------- | ------------------------------------------- | ------------------------------------- |
| `missing_in_ledger`   | The provider has money our ledger never saw | Lost webhook, watcher behind          |
| `missing_at_provider` | The ledger has money the provider does not  | Refund or cancel done outside the app |
| `amount_mismatch`     | Both have it, different amounts             | Partial refund, late extra transfer   |

Dashboard → **Reconciliation** lists them; an owner marks one resolved after deciding. Resolving never
changes the ledger: if money must move, post a correction on purpose.
