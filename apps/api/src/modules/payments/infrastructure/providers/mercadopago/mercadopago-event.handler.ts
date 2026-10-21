import { Logger } from '@nestjs/common';
import { InboundEventHandler } from '../../../../inbound/application/ports/inbound-ports';
import type { InboundEvent } from '../../../../inbound/domain/inbound-event';
import type { SettleProviderPaymentUseCase } from '../../../application/use-cases/settle-provider-payment.use-case';
import type { ProviderOutcome } from '../../../domain/provider-outcome';
import type { MercadoPagoApi, MercadoPagoPayment } from './mercadopago-client';
import { paidAmount } from './mercadopago.provider';

/** The fields we read from a notification (the signature was already verified on ingestion). */
interface MercadoPagoNotification {
  type?: string;
  action?: string;
  data?: { id?: string | number };
}

/**
 * Mercado Pago notifications only say "payment X changed". The handler always asks the API for
 * the payment before changing any state (feature 12): the notification body is never trusted.
 *   approved             → paid
 *   rejected · cancelled → declined (Checkout Pro lets the customer try again on the same preference)
 *   anything else        → still open, nothing to do
 * It lives in infrastructure because it calls Mercado Pago over HTTP.
 */
export class MercadoPagoEventHandler extends InboundEventHandler {
  readonly provider = 'mercadopago';
  private readonly logger = new Logger(MercadoPagoEventHandler.name);

  constructor(
    private readonly api: MercadoPagoApi,
    private readonly settle: SettleProviderPaymentUseCase,
  ) {
    super();
  }

  async handle(event: InboundEvent): Promise<void> {
    const notification = JSON.parse(event.payload) as MercadoPagoNotification;
    const paymentId = notification.data?.id;
    if (notification.type !== 'payment' || paymentId === undefined) return;

    const payment = await this.api.getPayment(String(paymentId));
    const outcome = toOutcome(payment);
    if (!outcome || !payment.external_reference) return;

    const result = await this.settle.execute({
      provider: this.provider,
      externalReference: payment.external_reference,
      outcome,
    });
    this.logger.log(`mercadopago payment ${payment.id} (${payment.status}): ${result}`);
  }
}

function toOutcome(payment: MercadoPagoPayment): ProviderOutcome | null {
  switch (payment.status) {
    case 'approved':
      return { kind: 'succeeded', amount: paidAmount(payment) };
    case 'rejected':
    case 'cancelled':
      return { kind: 'declined', reason: payment.status_detail ?? payment.status };
    default:
      return null;
  }
}
