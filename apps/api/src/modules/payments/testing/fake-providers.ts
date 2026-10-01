import type {
  PaymentProvider,
  ProviderPayment,
  ProviderPaymentRequest,
} from '../application/ports/payment-provider';
import type { ProviderId } from '../domain/payment-route';

/** Records calls and returns plausible instructions, without any network. */
export class FakeCardProvider implements PaymentProvider {
  readonly id: ProviderId = 'stripe';
  readonly calls: ProviderPaymentRequest[] = [];

  createPayment(request: ProviderPaymentRequest): Promise<ProviderPayment> {
    this.calls.push(request);
    return Promise.resolve({
      externalReference: `pi_fake_${request.attemptId}`,
      instructions: {
        type: 'card_client_secret',
        clientSecret: `pi_fake_${request.attemptId}_secret`,
      },
    });
  }
}

export class FakeTronProvider implements PaymentProvider {
  readonly id: ProviderId = 'tron';
  readonly calls: ProviderPaymentRequest[] = [];

  createPayment(request: ProviderPaymentRequest): Promise<ProviderPayment> {
    this.calls.push(request);
    const address = `TFakeAddress${String(this.calls.length).padStart(22, '0')}`;
    return Promise.resolve({
      externalReference: address,
      instructions: {
        type: 'crypto_transfer',
        network: 'tron-nile',
        token: 'USDT',
        address,
        amount: request.amount.toMinorUnits(),
      },
    });
  }
}
