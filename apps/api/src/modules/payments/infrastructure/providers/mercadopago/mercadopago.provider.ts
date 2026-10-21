import { Money } from '../../../../../shared/domain/money';
import type {
  PaymentProvider,
  ProviderPayment,
  ProviderPaymentRequest,
} from '../../../application/ports/payment-provider';
import type { ProviderId } from '../../../domain/payment-route';
import type { ProviderOutcome } from '../../../domain/provider-outcome';
import type { MercadoPagoApi, MercadoPagoPayment } from './mercadopago-client';

/**
 * Checkout Pro (ADR 0022): we create a preference and send the customer to Mercado Pago's own
 * page, so card and wallet data never reach our servers. The attempt id travels as the
 * preference's external reference and is the attempt's external reference here too: every
 * payment made on that preference points back to exactly one attempt.
 */
export class MercadoPagoProvider implements PaymentProvider {
  readonly id: ProviderId = 'mercadopago';

  constructor(private readonly api: MercadoPagoApi) {}

  async createPayment(request: ProviderPaymentRequest): Promise<ProviderPayment> {
    const { amount } = request;
    const preference = await this.api.createPreference(
      {
        items: [
          {
            id: request.chargeId,
            title: 'Payment',
            quantity: 1,
            unit_price: toDecimal(amount),
            currency_id: amount.currency,
          },
        ],
        external_reference: request.attemptId,
        metadata: {
          charge_id: request.chargeId,
          attempt_id: request.attemptId,
          organization_id: request.organizationId,
        },
      },
      request.attemptId,
    );
    return {
      externalReference: request.attemptId,
      instructions: { type: 'redirect', url: preference.init_point },
    };
  }

  /** Only a final answer: an approved payment. Rejections leave the preference open to retry. */
  async fetchOutcome(externalReference: string): Promise<ProviderOutcome | null> {
    const { results } = await this.api.searchPayments({ externalReference });
    const approved = results.find((p) => p.status === 'approved');
    return approved ? { kind: 'succeeded', amount: paidAmount(approved) } : null;
  }
}

/** Mercado Pago wants decimal prices; built from the integer string, never by float division. */
export function toDecimal(amount: Money): number {
  const digits = amount.toMinorUnits().padStart(amount.decimals + 1, '0');
  const split = digits.length - amount.decimals;
  return Number(`${digits.slice(0, split)}.${digits.slice(split)}`);
}

/** Back to minor units through a fixed-decimals string (15.5 → "15.50" → 1550n). */
export function paidAmount(payment: MercadoPagoPayment): Money {
  const probe = Money.of(0n, payment.currency_id);
  const fixed = payment.transaction_amount.toFixed(probe.decimals).replace('.', '');
  return Money.of(BigInt(fixed), payment.currency_id);
}
