import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { Money } from '../../../shared/domain/money';
import {
  InvalidLedgerEntryError,
  InvalidLedgerTransitionError,
  UnbalancedTransactionError,
} from './errors';
import { balanceOf } from './ledger-account';
import { type LedgerEntry, LedgerTransaction } from './ledger-transaction';

const NOW = new Date('2026-10-03T12:00:00Z');
const usdt = (units: bigint) => Money.of(units, 'USDT');

const record = (entries: LedgerEntry[], status: 'pending' | 'posted' = 'posted') =>
  LedgerTransaction.record({
    id: 'tx-1',
    externalId: 'event-1',
    organizationId: 'org-1',
    reference: 'charge-1',
    description: 'test',
    entries,
    status,
    now: NOW,
  });

describe('LedgerTransaction', () => {
  it('accepts a balanced transaction, split across several credits', () => {
    const tx = record([
      { accountId: 'awaiting', direction: 'debit', amount: usdt(12_500_000n) },
      { accountId: 'available', direction: 'credit', amount: usdt(10_000_000n) },
      { accountId: 'overpayments', direction: 'credit', amount: usdt(2_500_000n) },
    ]);

    expect(tx.status).toBe('posted');
    expect(tx.postedAt).toEqual(NOW);
  });

  it('rejects debits that differ from credits', () => {
    expect(() =>
      record([
        { accountId: 'a', direction: 'debit', amount: usdt(10n) },
        { accountId: 'b', direction: 'credit', amount: usdt(9n) },
      ]),
    ).toThrow(UnbalancedTransactionError);
  });

  it('balances each currency on its own', () => {
    expect(() =>
      record([
        { accountId: 'a', direction: 'debit', amount: usdt(10n) },
        { accountId: 'b', direction: 'credit', amount: Money.of(10n, 'USD') },
      ]),
    ).toThrow(UnbalancedTransactionError);
  });

  it.each([
    ['a single entry', [{ accountId: 'a', direction: 'debit', amount: usdt(1n) }]],
    [
      'a zero amount',
      [
        { accountId: 'a', direction: 'debit', amount: usdt(0n) },
        { accountId: 'b', direction: 'credit', amount: usdt(0n) },
      ],
    ],
  ] as const)('rejects %s', (_label, entries) => {
    expect(() => record([...entries])).toThrow(InvalidLedgerEntryError);
  });

  it('lets only a pending transaction be posted or archived, once', () => {
    const tx = record(
      [
        { accountId: 'a', direction: 'debit', amount: usdt(5n) },
        { accountId: 'b', direction: 'credit', amount: usdt(5n) },
      ],
      'pending',
    );

    tx.post(NOW);
    expect(tx.status).toBe('posted');
    expect(() => tx.archive()).toThrow(InvalidLedgerTransitionError);
  });

  it('builds reversing entries that cancel the original exactly', () => {
    const tx = record([
      { accountId: 'a', direction: 'debit', amount: usdt(7n) },
      { accountId: 'b', direction: 'credit', amount: usdt(7n) },
    ]);

    expect(tx.reversalEntries().map((e) => e.direction)).toEqual(['credit', 'debit']);
  });

  // Property: whatever balanced transactions happen, the trial balance is zero and each
  // account's balance is exactly the sum of its own entries.
  it('keeps the trial balance at zero for any sequence of balanced transactions', () => {
    const accounts = ['asset', 'awaiting', 'available', 'overpayments'] as const;
    const normals = {
      asset: 'debit',
      awaiting: 'credit',
      available: 'credit',
      overpayments: 'credit',
    } as const;
    const movement = fc.record({
      from: fc.constantFrom(...accounts),
      to: fc.constantFrom(...accounts),
      units: fc.bigInt({ min: 1n, max: 10n ** 24n }),
    });

    fc.assert(
      fc.property(fc.array(movement, { maxLength: 50 }), (movements) => {
        const debits = new Map<string, bigint>();
        const credits = new Map<string, bigint>();
        for (const { from, to, units } of movements) {
          const tx = record([
            { accountId: to, direction: 'debit', amount: usdt(units) },
            { accountId: from, direction: 'credit', amount: usdt(units) },
          ]);
          for (const entry of tx.entries) {
            const side = entry.direction === 'debit' ? debits : credits;
            side.set(entry.accountId, (side.get(entry.accountId) ?? 0n) + entry.amount.amount);
          }
        }
        const totalDebits = [...debits.values()].reduce((a, b) => a + b, 0n);
        const totalCredits = [...credits.values()].reduce((a, b) => a + b, 0n);
        expect(totalDebits).toBe(totalCredits);

        // Assets = liabilities: debit-normal balances equal credit-normal balances.
        const balances = accounts.map((a) =>
          balanceOf(normals[a], debits.get(a) ?? 0n, credits.get(a) ?? 0n),
        );
        const assets = balances[0] ?? 0n;
        const liabilities = balances.slice(1).reduce((a, b) => a + b, 0n);
        expect(assets).toBe(liabilities);
      }),
    );
  });
});
