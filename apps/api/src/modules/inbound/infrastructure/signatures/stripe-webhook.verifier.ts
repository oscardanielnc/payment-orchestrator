import Stripe from 'stripe';
import { WebhookVerifier } from '../../application/ports/inbound-ports';
import { InvalidWebhookSignatureError } from '../../domain/errors';
import type { VerifiedEvent } from '../../domain/inbound-event';

/**
 * Stripe's `Stripe-Signature` (t=…,v1=…) checked with the official SDK, which also handles
 * several v1 signatures during secret rotation and the 5-minute replay tolerance.
 */
export class StripeWebhookVerifier extends WebhookVerifier {
  readonly provider = 'stripe';

  constructor(
    private readonly stripe: Stripe,
    private readonly endpointSecret: string,
  ) {
    super();
  }

  verify(rawBody: Buffer, headers: Record<string, string | undefined>): VerifiedEvent {
    const signature = headers['stripe-signature'];
    if (!signature) throw new InvalidWebhookSignatureError('missing Stripe-Signature header');
    try {
      const event = this.stripe.webhooks.constructEvent(rawBody, signature, this.endpointSecret);
      return { externalId: event.id, type: event.type };
    } catch (error) {
      throw new InvalidWebhookSignatureError((error as Error).message);
    }
  }
}
