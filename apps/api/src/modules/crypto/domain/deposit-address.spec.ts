import { describe, expect, it } from 'vitest';
import { Money } from '../../../shared/domain/money';
import { DepositAddress } from './deposit-address';

const TEN_USDT = 10_000_000n;

const deposit = () =>
  DepositAddress.create({
    id: 'dep-1',
    network: 'tron-nile',
    address: 'TAddress',
    matchKey: 'ab'.repeat(20),
    derivationIndex: 0,
    attemptId: 'attempt-1',
    chargeId: 'charge-1',
    organizationId: 'org-1',
    expected: Money.of(TEN_USDT, 'USDT'),
    now: new Date('2026-10-01T12:00:00Z'),
  });

describe('DepositAddress', () => {
  it('is funded by an exact transfer', () => {
    const credit = deposit().credit(TEN_USDT);

    expect(credit).toMatchObject({ status: 'funded', justFunded: true });
  });

  it('stays partial on an underpayment and is funded when the rest arrives', () => {
    const address = deposit();

    expect(address.credit(4_000_000n)).toMatchObject({ status: 'partial', justFunded: false });
    const second = address.credit(6_000_000n);

    expect(second).toMatchObject({ status: 'funded', justFunded: true });
    expect(second.received.toMinorUnits()).toBe('10000000');
  });

  it('counts an overpayment as paid and keeps the full amount received', () => {
    const credit = deposit().credit(12_500_000n);

    expect(credit).toMatchObject({ status: 'overfunded', justFunded: true });
    expect(credit.received.toMinorUnits()).toBe('12500000');
  });

  it('reports justFunded only once, even if more money arrives later', () => {
    const address = deposit();
    address.credit(TEN_USDT);

    expect(address.credit(1n)).toMatchObject({ status: 'overfunded', justFunded: false });
  });
});
