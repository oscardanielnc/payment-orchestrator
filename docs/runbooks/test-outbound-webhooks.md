# Test outbound webhooks locally

The receiver tool plays the merchant: it verifies each signature with
[docs/examples/verify-webhook-signature.mjs](../examples/verify-webhook-signature.mjs), the snippet merchants copy.

## Steps

1. Dashboard → **Webhooks** → add `http://localhost:4000/webhooks` → copy the `whsec_…` secret
   (`http://localhost` is accepted only outside production)
2. Start the receiver (answers 500 twice, then 200, to show the retries):

   ```sh
   pnpm --filter @po/api webhook:receiver whsec_… --fail 2
   ```

3. Pay a charge (a payment link with USDT on Nile, or a card in Stripe test mode)
4. The receiver prints `✔ signature ok  charge.succeeded  <event id>` with `→ 500` twice, then `→ 200`.
   Retries follow the backoff (30 s, 1 min…); with `--fail 2` the delivery lands in about 90 s
5. Dashboard → Webhooks → Deliveries: the delivery is **Delivered** with 3 attempts; click it to see
   each response and the exact JSON sent

## Receiving webhooks in your server

- Verify `PO-Signature` against the **raw** body with the snippet above; reject after 5 minutes
- Answer 2xx fast and do slow work afterwards; anything else is retried for about an hour
- Delivery is at-least-once: skip `PO-Event-Id` values you already processed
