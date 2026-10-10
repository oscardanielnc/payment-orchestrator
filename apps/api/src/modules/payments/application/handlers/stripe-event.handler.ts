import { Logger } from '@nestjs/common';
import { Money } from '../../../../shared/domain/money';
import { InboundEventHandler } from '../../../inbound/application/ports/inbound-ports';
import type { InboundEvent } from '../../../inbound/domain/inbound-event';
import type { ProviderOutcome } from '../../domain/provider-outcome';
import type { SettleProviderPaymentUseCase } from '../use-cases/settle-provider-payment.use-case';

/** The fields we read from a Stripe event (the signature was already verified on ingestion). */
interface StripeEvent {
  type: string;
  data: {
    object: {
      id: string;
      amount_received?: number;
      currency?: string;
      last_payment_error?: { decline_code?: string; code?: string; message?: string } | null;
    };
  };
}

/**
 * Stripe PaymentIntent events → provider outcomes:
 *   payment_intent.succeeded      → paid
 *   payment_intent.payment_failed → declined (the customer can retry on the same intent)
 *   payment_intent.canceled       → failed for good
 * Any other event type is accepted and ignored.
 */
export class StripeEventHandler extends InboundEventHandler {
  readonly provider = 'stripe';
  private readonly logger = new Logger(StripeEventHandler.name);

  constructor(private readonly settle: SettleProviderPaymentUseCase) {
    super();
  }

  async handle(event: InboundEvent): Promise<void> {
    const stripeEvent = JSON.parse(event.payload) as StripeEvent;
    const outcome = toOutcome(stripeEvent);
    if (!outcome) return;

    const intent = stripeEvent.data.object;
    const result = await this.settle.execute({
      provider: this.provider,
      externalReference: intent.id,
      outcome,
    });
    this.logger.log(`stripe ${stripeEvent.type} for ${intent.id}: ${result}`);
  }
}

function toOutcome(event: StripeEvent): ProviderOutcome | null {
  const intent = event.data.object;
  switch (event.type) {
    case 'payment_intent.succeeded':
      return {
        kind: 'succeeded',
        // Stripe's smallest currency unit is our minor unit.
        amount: Money.of(
          BigInt(intent.amount_received ?? 0),
          (intent.currency ?? '').toUpperCase(),
        ),
      };
    case 'payment_intent.payment_failed': {
      const error = intent.last_payment_error;
      return {
        kind: 'declined',
        reason: error?.decline_code ?? error?.code ?? error?.message ?? 'declined',
      };
    }
    case 'payment_intent.canceled':
      return { kind: 'canceled' };
    default:
      return null;
  }
}
