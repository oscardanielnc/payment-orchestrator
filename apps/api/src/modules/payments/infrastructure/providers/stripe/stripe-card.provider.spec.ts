import { describe, expect, it, vi } from 'vitest';
import { Money } from '../../../../../shared/domain/money';
import { StripeCardProvider } from './stripe-card.provider';

const request = {
  attemptId: 'attempt-1',
  chargeId: 'charge-1',
  organizationId: 'org-1',
  method: 'card' as const,
  amount: Money.of(2500n, 'USD'),
};

describe('StripeCardProvider', () => {
  it('creates a card-only PaymentIntent with our ids in metadata and the attempt as idempotency key', async () => {
    const create = vi.fn().mockResolvedValue({ id: 'pi_123', client_secret: 'fake-client-secret' });
    const provider = new StripeCardProvider({ paymentIntents: { create } });

    const payment = await provider.createPayment(request);

    expect(create).toHaveBeenCalledWith(
      {
        amount: 2500,
        currency: 'usd',
        automatic_payment_methods: { enabled: true, allow_redirects: 'never' },
        metadata: { chargeId: 'charge-1', attemptId: 'attempt-1', organizationId: 'org-1' },
      },
      { idempotencyKey: 'attempt-1' },
    );
    expect(payment).toEqual({
      externalReference: 'pi_123',
      instructions: { type: 'card_client_secret', clientSecret: 'fake-client-secret' },
    });
  });

  it('refuses amounts a JavaScript number cannot hold exactly', async () => {
    const provider = new StripeCardProvider({ paymentIntents: { create: vi.fn() } });

    await expect(
      provider.createPayment({ ...request, amount: Money.of(2n ** 60n, 'USD') }),
    ).rejects.toThrow('too large');
  });
});
