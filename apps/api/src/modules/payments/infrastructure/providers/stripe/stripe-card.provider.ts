import type {
  PaymentProvider,
  ProviderPayment,
  ProviderPaymentRequest,
} from '../../../application/ports/payment-provider';
import { Money } from '../../../../../shared/domain/money';
import type { ProviderId } from '../../../domain/payment-route';
import type { ProviderOutcome } from '../../../domain/provider-outcome';
import type { StripePaymentIntentsApi } from './stripe-client';

/**
 * Card payments through Stripe PaymentIntents (test mode). The customer types the card into
 * Stripe's own UI with the client secret; card data never reaches our servers (no PCI scope).
 */
export class StripeCardProvider implements PaymentProvider {
  readonly id: ProviderId = 'stripe';

  constructor(private readonly stripe: StripePaymentIntentsApi) {}

  async createPayment(request: ProviderPaymentRequest): Promise<ProviderPayment> {
    const amount = Number(request.amount.amount);
    if (!Number.isSafeInteger(amount)) throw new Error('Amount too large for Stripe');

    const intent = await this.stripe.paymentIntents.create(
      {
        amount, // our minor units are Stripe's smallest currency unit (cents, céntimos)
        currency: request.amount.currency.toLowerCase(),
        // Card-only, no redirects: confirmable from our checkout or the API without a return URL.
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: {
          chargeId: request.chargeId,
          attemptId: request.attemptId,
          organizationId: request.organizationId,
        },
      },
      { idempotencyKey: request.attemptId },
    );
    if (!intent.client_secret) throw new Error(`PaymentIntent ${intent.id} has no client secret`);

    return {
      externalReference: intent.id,
      instructions: { type: 'card_client_secret', clientSecret: intent.client_secret },
    };
  }

  /** Only final states: a decline leaves the intent open for the customer to retry. */
  async fetchOutcome(externalReference: string): Promise<ProviderOutcome | null> {
    const intent = await this.stripe.paymentIntents.retrieve(externalReference);
    switch (intent.status) {
      case 'succeeded':
        return {
          kind: 'succeeded',
          amount: Money.of(BigInt(intent.amount_received), intent.currency.toUpperCase()),
        };
      case 'canceled':
        return { kind: 'canceled' };
      default:
        return null;
    }
  }
}
