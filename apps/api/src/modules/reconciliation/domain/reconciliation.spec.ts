import { describe, expect, it } from 'vitest';
import { compareRecords, type Discrepancy, type ReconRecord } from './compare';
import { FindingNotOpenError } from './errors';
import { Finding } from './finding';
import { previousUtcDay, utcDay } from './window';

const record = (subject: string, amount: bigint, currency = 'USD'): ReconRecord => ({
  subject,
  organizationId: 'org-1',
  chargeId: `charge-${subject}`,
  currency,
  amount,
});

describe('compareRecords', () => {
  it('matches equal amounts and reports each kind of difference, sorted by subject', () => {
    const { matched, discrepancies } = compareRecords(
      [record('a', 100n), record('b', 50n), record('d', 70n)],
      [record('a', 100n), record('c', 30n), record('d', 60n)],
    );

    expect(matched).toEqual(['a']);
    expect(discrepancies.map((d) => [d.subject, d.kind, d.providerAmount, d.ledgerAmount])).toEqual(
      [
        ['b', 'missing_in_ledger', 50n, 0n],
        ['c', 'missing_at_provider', 0n, 30n],
        ['d', 'amount_mismatch', 70n, 60n],
      ],
    );
  });

  it('treats zero as absent: an empty address with no ledger entry is not a finding', () => {
    expect(compareRecords([record('a', 0n)], [])).toEqual({ matched: [], discrepancies: [] });
    expect(compareRecords([record('a', 0n)], [record('a', 5n)]).discrepancies[0]?.kind).toBe(
      'missing_at_provider',
    );
  });

  it('adds up records with the same subject (two deposit addresses of one charge)', () => {
    expect(
      compareRecords([record('a', 40n), record('a', 60n)], [record('a', 100n)]).matched,
    ).toEqual(['a']);
  });

  it('never matches the same number in different currencies', () => {
    expect(
      compareRecords([record('a', 100n, 'USD')], [record('a', 100n, 'PEN')]).discrepancies,
    ).toHaveLength(1);
  });
});

const discrepancy = (overrides: Partial<Discrepancy> = {}): Discrepancy => ({
  kind: 'missing_in_ledger',
  subject: 'provider-payment:stripe:pi_1',
  organizationId: 'org-1',
  chargeId: null,
  currency: 'USD',
  providerAmount: 500n,
  ledgerAmount: 0n,
  ...overrides,
});
const t0 = new Date('2026-10-12T10:00:00Z');
const t1 = new Date('2026-10-13T10:00:00Z');

describe('Finding', () => {
  const open = () =>
    Finding.open({ id: 'f-1', source: 'stripe', discrepancy: discrepancy(), now: t0 });

  it('opens with both amounts and who-knows-nothing-yet', () => {
    expect(open()).toMatchObject({ status: 'open', firstSeenAt: t0, resolvedBy: null });
  });

  it('is resolved by a person with a note, only while open', () => {
    const finding = open();
    finding.resolve({ userId: 'user-1', note: 'Refunded at Stripe', now: t1 });

    expect(finding).toMatchObject({ status: 'resolved', resolvedBy: 'user-1', resolvedAt: t1 });
    expect(() => finding.resolve({ userId: 'user-1', note: null, now: t1 })).toThrow(
      FindingNotOpenError,
    );
  });

  it('keeps a resolution when a later run sees the same difference, reopens when it changed', () => {
    const finding = open();
    finding.resolve({ userId: 'user-1', note: null, now: t0 });

    finding.observe(discrepancy(), t1);
    expect(finding).toMatchObject({ status: 'resolved', lastSeenAt: t1 });

    finding.observe(discrepancy({ kind: 'amount_mismatch', ledgerAmount: 400n }), t1);
    expect(finding).toMatchObject({ status: 'open', resolvedBy: null, kind: 'amount_mismatch' });
  });

  it('clears when a later run finds both sides in agreement, and reopens if it comes back', () => {
    const finding = open();
    finding.clear(t1);
    expect(finding.status).toBe('cleared');

    finding.observe(discrepancy(), t1);
    expect(finding.status).toBe('open');
  });
});

describe('windows', () => {
  it('reconciles whole UTC days, yesterday by default', () => {
    expect(utcDay(new Date('2026-10-13T23:59:59Z'))).toEqual({
      from: new Date('2026-10-13T00:00:00Z'),
      to: new Date('2026-10-14T00:00:00Z'),
    });
    expect(previousUtcDay(new Date('2026-10-13T00:30:00Z')).from).toEqual(
      new Date('2026-10-12T00:00:00Z'),
    );
  });
});
