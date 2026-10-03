# Test a USDT payment on TRON Nile, end to end

Testnet only. Nothing here moves real money.

## Once: wallets

```sh
pnpm --filter @po/api crypto:xpub        # deposit wallet: put TRON_DEPOSIT_XPUB in .env, keep the mnemonic private
pnpm --filter @po/api tron:payer new     # customer wallet: put TRON_TEST_PAYER_PRIVATE_KEY in .env
```

Fund the **payer address** at https://nileex.io/join/getJoinPage: test TRX (fees) and test USDT are
requested separately (or ask TronFAQBot `!nile_usdt <address>`),
then check: `pnpm --filter @po/api tron:payer balance`.

## Fastest: one command

```sh
docker compose up -d && pnpm --filter @po/api db:deploy
pnpm --filter @po/api demo:tron          # org → charge → attempt → real Nile payment → waits until paid
```

## Every time, through the HTTP API

```sh
docker compose up -d
pnpm --filter @po/api db:deploy
pnpm --filter @po/api org:create "Acme Coffee"          # copy the printed API key
pnpm --filter @po/api build
pnpm --filter @po/api start                             # terminal 1: API on :3000
pnpm --filter @po/api start:worker                      # terminal 2: watcher, logs every payment
```

Terminal 3 (`$KEY` = the API key):

```sh
# 1. Charge of 1 USDT (6 decimals → 1000000)
curl -s -X POST localhost:3000/v1/charges -H "Authorization: Bearer $KEY" \
  -H "Idempotency-Key: demo-1" -H "Content-Type: application/json" \
  -d '{"amount":"1000000","currency":"USDT","reference":"demo-1"}'

# 2. Customer picks USDT on TRON → deposit address in instructions.address
curl -s -X POST localhost:3000/v1/charges/<chargeId>/attempts -H "Authorization: Bearer $KEY" \
  -H "Idempotency-Key: demo-1-attempt" -H "Content-Type: application/json" -d '{"method":"usdt_tron"}'

# 3. Customer pays
pnpm --filter @po/api tron:payer pay <address> 1000000

# 4. About a minute later the worker logs "1 new transfer(s), 1 charge(s) paid"
curl -s localhost:3000/v1/charges/<chargeId> -H "Authorization: Bearer $KEY"   # status: succeeded
```

Try `pay <address> 400000` then `pay <address> 600000` to see an underpayment complete.
