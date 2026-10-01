import type { Money } from '../../../../shared/domain/money';
import type { PaymentInstructions } from '../../domain/payment-instructions';
import type { PaymentMethod, ProviderId } from '../../domain/payment-route';

export interface ProviderPaymentRequest {
  /** Our attempt id: providers must use it as their idempotency key. */
  attemptId: string;
  chargeId: string;
  organizationId: string;
  method: PaymentMethod;
  amount: Money;
}

export interface ProviderPayment {
  externalReference: string;
  instructions: PaymentInstructions;
}

/**
 * The one contract every provider adapter implements: Stripe, Mercado Pago, TRON, Base.
 * Use cases depend on this, never on an SDK (ADR 0002).
 */
export abstract class PaymentProvider {
  abstract readonly id: ProviderId;
  abstract createPayment(request: ProviderPaymentRequest): Promise<ProviderPayment>;
}
