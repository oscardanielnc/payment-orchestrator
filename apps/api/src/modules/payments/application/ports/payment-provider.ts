import type { Money } from '../../../../shared/domain/money';
import type { PaymentInstructions } from '../../domain/payment-instructions';
import type { PaymentMethod, ProviderId } from '../../domain/payment-route';
import type { ProviderOutcome } from '../../domain/provider-outcome';

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
  /**
   * Asks the provider for a payment's final state, in case its webhook never arrived.
   * `null` while it is still open. Only providers that report by webhook implement it.
   */
  fetchOutcome?(externalReference: string): Promise<ProviderOutcome | null>;
}
