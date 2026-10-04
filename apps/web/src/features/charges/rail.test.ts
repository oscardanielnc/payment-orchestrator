import type { Charge, LedgerEntry, PaymentAttempt } from '@po/contracts';
import { describe, expect, it } from 'vitest';
import { railStations } from './rail';

const charge = (status: Charge['status']): Charge => ({
  id: '00000000-0000-4000-8000-000000000001',
  object: 'charge',
  amount: '10000000',
  currency: 'USDT',
  status,
  description: null,
  reference: null,
  expiresAt: '2026-10-04T12:30:00.000Z',
  createdAt: '2026-10-04T12:00:00.000Z',
  updatedAt: '2026-10-04T12:00:00.000Z',
});
const attempt = (status: PaymentAttempt['status'], failureReason: string | null = null) =>
  ({ id: 'a1', method: 'usdt_tron', status, failureReason }) as PaymentAttempt;
const postedAvailable = { status: 'posted', account: 'merchant:org-1:available' } as LedgerEntry;

const states = (stations: { label: string; state: string }[]) =>
  stations.map((s) => `${s.label}:${s.state}`);

describe('railStations', () => {
  it('waits for the customer before any attempt', () => {
    expect(states(railStations(charge('pending'), [], []))).toEqual([
      'Created:done',
      'Routed:current',
      'Paid:upcoming',
      'Posted:upcoming',
    ]);
  });

  it('shows the decline while the attempt stays open', () => {
    const stations = railStations(
      charge('processing'),
      [attempt('pending', 'generic_decline')],
      [],
    );

    expect(stations[2]).toMatchObject({
      label: 'Paid',
      state: 'current',
      detail: 'Declined: generic_decline',
    });
  });

  it('completes once paid and posted to the merchant balance', () => {
    expect(
      states(railStations(charge('succeeded'), [attempt('succeeded')], [postedAvailable])),
    ).toEqual(['Created:done', 'Routed:done', 'Paid:done', 'Posted:done']);
  });

  it('ends in Failed for a failed charge', () => {
    expect(railStations(charge('failed'), [attempt('failed')], []).at(-1)).toMatchObject({
      label: 'Failed',
      state: 'failed',
    });
  });
});
