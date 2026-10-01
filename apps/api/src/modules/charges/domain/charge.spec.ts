import { describe, expect, it } from 'vitest';
import { Money } from '../../../shared/domain/money';
import { Charge } from './charge';
import { ALLOWED_TRANSITIONS, type ChargeStatus } from './charge-status';
import {
  ChargeNotPayableError,
  InvalidChargeAmountError,
  InvalidChargeTransitionError,
} from './errors';

const NOW = new Date('2026-10-01T12:00:00Z');
const later = (seconds: number) => new Date(NOW.getTime() + seconds * 1000);

const newCharge = (amount = 10_000_000n) =>
  Charge.create({
    id: 'charge-1',
    organizationId: 'org-1',
    amount: Money.of(amount, 'USDT'),
    reference: 'order-4821',
    expiresInSeconds: 1800,
    now: NOW,
  });

/** Moves a fresh charge to `status` through legal transitions only. */
function chargeIn(status: ChargeStatus): Charge {
  const charge = newCharge();
  if (status === 'expired') charge.expire(later(1800));
  if (status === 'processing' || status === 'succeeded' || status === 'failed') {
    charge.startProcessing(later(1));
  }
  if (status === 'succeeded') charge.markSucceeded(later(2));
  if (status === 'failed') charge.markFailed(later(2));
  charge.pullEvents();
  return charge;
}

const move = (charge: Charge, to: ChargeStatus) => {
  const at = later(3600);
  const moves: Record<ChargeStatus, () => void> = {
    pending: () => {
      throw new InvalidChargeTransitionError(charge.status, 'pending');
    },
    processing: () => charge.startProcessing(at),
    succeeded: () => charge.markSucceeded(at),
    failed: () => charge.markFailed(at),
    expired: () => charge.expire(at),
  };
  moves[to]();
};

describe('Charge', () => {
  it('starts pending, expires after the given seconds and records charge.created', () => {
    const charge = newCharge();

    expect(charge.status).toBe('pending');
    expect(charge.expiresAt).toEqual(later(1800));
    expect(charge.pullEvents().map((event) => event.type)).toEqual(['charge.created']);
  });

  it.each([0n, -1n])('rejects an amount of %s', (amount) => {
    expect(() => newCharge(amount)).toThrow(InvalidChargeAmountError);
  });

  it('follows the happy path and records one event per change', () => {
    const charge = chargeIn('pending');

    charge.startProcessing(later(10));
    charge.markSucceeded(later(20));

    expect(charge.status).toBe('succeeded');
    expect(charge.updatedAt).toEqual(later(20));
    expect(charge.pullEvents().map((event) => event.type)).toEqual([
      'charge.processing',
      'charge.succeeded',
    ]);
  });

  it('accepts payment attempts only while open and not expired', () => {
    const charge = chargeIn('pending');

    charge.beginPaymentAttempt(later(10));
    expect(charge.status).toBe('processing');
    charge.beginPaymentAttempt(later(20)); // switching method keeps it processing
    expect(charge.status).toBe('processing');

    expect(() => charge.beginPaymentAttempt(later(1800))).toThrow(ChargeNotPayableError);
    expect(() => chargeIn('pending').beginPaymentAttempt(later(1800))).toThrow(
      ChargeNotPayableError,
    );
    expect(() => chargeIn('succeeded').beginPaymentAttempt(later(10))).toThrow(
      ChargeNotPayableError,
    );
  });

  it('cannot expire before its expiry time', () => {
    expect(() => chargeIn('pending').expire(later(60))).toThrow(InvalidChargeTransitionError);
  });

  // Exhaustive: every (from, to) pair not in the table must be rejected.
  const statuses: ChargeStatus[] = ['pending', 'processing', 'succeeded', 'failed', 'expired'];
  const illegal = statuses.flatMap((from) =>
    statuses.filter((to) => !ALLOWED_TRANSITIONS[from].includes(to)).map((to) => [from, to]),
  );

  it.each(illegal)('rejects %s → %s', (from, to) => {
    const charge = chargeIn(from);

    expect(() => move(charge, to)).toThrow(InvalidChargeTransitionError);
    expect(charge.status).toBe(from);
  });
});
