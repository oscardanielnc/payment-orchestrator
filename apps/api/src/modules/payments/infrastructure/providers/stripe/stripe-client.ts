import Stripe from 'stripe';

export type StripeIntentSummary = Pick<
  Stripe.PaymentIntent,
  'id' | 'status' | 'amount_received' | 'currency' | 'metadata'
>;

/** The slice of the Stripe SDK this module uses: small enough to fake in tests. */
export interface StripePaymentIntentsApi {
  paymentIntents: {
    create(
      params: Stripe.PaymentIntentCreateParams,
      options: Stripe.RequestOptions,
    ): Promise<Pick<Stripe.PaymentIntent, 'id' | 'client_secret'>>;
    retrieve(id: string): Promise<StripeIntentSummary>;
    /** Reconciliation reads a day of intents; the SDK pages through them. */
    list(params: Stripe.PaymentIntentListParams): {
      autoPagingToArray(options: { limit: number }): Promise<StripeIntentSummary[]>;
    };
  };
}

/** DI token for the Stripe client (overridden in tests with a fake). */
export const STRIPE_CLIENT = Symbol('STRIPE_CLIENT');

export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    timeout: 10_000, // every outbound call has a timeout (standard, section 8)
    maxNetworkRetries: 2, // safe: creation sends an idempotency key
    appInfo: { name: 'payment-orchestrator' },
  });
}
