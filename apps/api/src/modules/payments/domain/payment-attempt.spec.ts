import { describe, expect, it } from 'vitest';
import { InvalidAttemptTransitionError } from './errors';
import { PaymentAttempt } from './payment-attempt';

const start = () =>
  PaymentAttempt.start({
    id: 'attempt-1',
    chargeId: 'charge-1',
    organizationId: 'org-1',
    method: 'usdt_tron',
    provider: 'tron',
    externalReference: 'TAddress',
    instructions: {
      type: 'crypto_transfer',
      network: 'tron-nile',
      token: 'USDT',
      address: 'TAddress',
      amount: '10000000',
    },
    now: new Date('2026-10-01T12:00:00Z'),
  });

describe('PaymentAttempt', () => {
  it('starts pending', () => {
    expect(start().status).toBe('pending');
  });

  it('settles only once', () => {
    const attempt = start();
    attempt.markSucceeded(new Date('2026-10-01T12:05:00Z'));

    expect(attempt.status).toBe('succeeded');
    expect(() => attempt.markFailed(new Date())).toThrow(InvalidAttemptTransitionError);
    expect(() => attempt.markSucceeded(new Date())).toThrow(InvalidAttemptTransitionError);
  });
});
