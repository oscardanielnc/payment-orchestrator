# Test a USDC payment on Base Sepolia, end to end

Testnet only. Nothing here moves real money.

## Once: wallets

```sh
pnpm --filter @po/api crypto:xpub base   # deposit wallet: writes BASE_DEPOSIT_XPUB to .env
pnpm --filter @po/api base:payer new     # customer wallet: writes BASE_TEST_PAYER_PRIVATE_KEY to .env
```

Secrets (mnemonic, private key) go to `~/payment-orchestrator-testnet-wallets.txt`, never to the screen.
Fund the **payer address** printed by `base:payer new`:

- USDC: https://faucet.circle.com (network: Base Sepolia)
- ETH for gas: https://portal.cdp.coinbase.com/products/faucet (Base Sepolia); a few cents of test ETH
  pay for hundreds of transfers

Check: `pnpm --filter @po/api base:payer balance`.

## Pay a link from the dashboard

1. API and worker running (`pnpm --filter @po/api start` and `start:worker`); the worker logs
   `Watching base-sepolia`
2. Dashboard → **New payment link** → currency `USDC · Base Sepolia testnet`, amount `1` → open the link
3. Pick **USDC on Base Sepolia** and copy the address, then:

   ```sh
   pnpm --filter @po/api base:payer pay <address> 1000000   # 1 USDC (6 decimals)
   ```

4. About 30 s later (12 confirmations + one poll) the checkout shows **Paid**; the charge's ledger has
   `Deposits on base-sepolia → Awaiting settlement → Available`

Try `pay <address> 400000` then `pay <address> 600000` to see an underpayment complete.
