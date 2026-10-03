# Test a card payment with Stripe (test mode)

Test mode only: the app refuses `sk_live_` keys.

## Once

1. Create a free Stripe account and stay in **Test mode** → Developers → API keys → copy the secret key (`sk_test_…`)
2. Install and log in to the Stripe CLI: `winget install Stripe.StripeCli` then `stripe login`
3. In `.env`: `STRIPE_SECRET_KEY=sk_test_…`

## Every time

```sh
stripe listen --forward-to localhost:3000/v1/webhooks/stripe   # terminal 1: prints whsec_… (put it in STRIPE_WEBHOOK_SECRET once)
pnpm --filter @po/api build
pnpm --filter @po/api start                                    # terminal 2: API
pnpm --filter @po/api start:worker                             # terminal 3: worker
```

Terminal 4 (PowerShell, `$H` holds the API key header):

```powershell
$charge  = Invoke-RestMethod -Method Post http://localhost:3000/v1/charges -Headers ($H + @{ 'Idempotency-Key' = 'card-001' }) -ContentType 'application/json' -Body '{"amount":"2500","currency":"USD"}'
$attempt = Invoke-RestMethod -Method Post "http://localhost:3000/v1/charges/$($charge.id)/attempts" -Headers ($H + @{ 'Idempotency-Key' = 'card-001-a' }) -ContentType 'application/json' -Body '{"method":"card"}'
$pi = ($attempt.instructions.clientSecret -split '_secret_')[0]
pnpm --filter @po/api stripe:pay $pi visa        # or: declined, then visa (retry); or: cancel
Invoke-RestMethod "http://localhost:3000/v1/charges/$($charge.id)" -Headers $H   # succeeded
```
