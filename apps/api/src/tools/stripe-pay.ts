import Stripe from 'stripe';
import { ConfigError, loadConfig } from '../config/load-config';
import { loadEnvFileIfPresent } from '../config/load-env-file';
import { createStripeClient } from '../modules/payments/infrastructure/providers/stripe/stripe-client';

/**
 * Developer tool (not part of the app's layers): plays the CUSTOMER paying by card, in Stripe
 * test mode, until the dashboard's checkout exists.
 *   pnpm --filter @po/api stripe:pay <payment intent id> [visa | declined | cancel]
 * Uses Stripe's test payment methods; the config guard guarantees a test-mode key.
 */
const TEST_CARDS: Record<string, string> = {
  visa: 'pm_card_visa',
  declined: 'pm_card_chargeDeclined',
};

async function main(): Promise<void> {
  const [intentId, action = 'visa'] = process.argv.slice(2);
  if (!intentId?.startsWith('pi_')) {
    throw new Error('Usage: stripe:pay <payment intent id (pi_…)> [visa | declined | cancel]');
  }
  loadEnvFileIfPresent();
  const stripeConfig = loadConfig(process.env).stripe;
  if (!stripeConfig)
    throw new Error('Stripe is not configured (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET)');
  const stripe = createStripeClient(stripeConfig.secretKey);

  if (action === 'cancel') {
    const intent = await stripe.paymentIntents.cancel(intentId);
    process.stdout.write(`PaymentIntent ${intent.id}: ${intent.status}\n`);
    return;
  }

  const paymentMethod = TEST_CARDS[action];
  if (!paymentMethod) throw new Error(`Unknown action "${action}": use visa, declined or cancel`);
  try {
    const intent = await stripe.paymentIntents.confirm(intentId, { payment_method: paymentMethod });
    process.stdout.write(`PaymentIntent ${intent.id}: ${intent.status}\n`);
  } catch (error) {
    if (error instanceof Stripe.errors.StripeCardError) {
      process.stdout.write(
        `Card declined as expected (${error.decline_code ?? error.code}); the intent can be retried\n`,
      );
      return;
    }
    throw error;
  }
  process.stdout.write(
    'Stripe now sends the webhook; with `stripe listen` running, the worker settles the charge.\n',
  );
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof ConfigError ? error.message : String(error)}\n`);
  process.exit(1);
});
