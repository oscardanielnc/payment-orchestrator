import { describe, expect, it } from 'vitest';
import { formatMinorUnits } from './money';

describe('formatMinorUnits', () => {
  it.each([
    ['10000000', 'USDT', '10.00'],
    ['1234567', 'USDT', '1.234567'],
    ['300000', 'USDT', '0.30'],
    ['250000', 'USD', '2,500.00'],
    ['5', 'USD', '0.05'],
    ['-4200', 'PEN', '-42.00'],
    // Beyond Number.MAX_SAFE_INTEGER: string arithmetic keeps every digit.
    ['9007199254740993', 'USD', '90,071,992,547,409.93'],
  ])('%s %s → %s', (amount, currency, expected) => {
    expect(formatMinorUnits(amount, currency)).toBe(expected);
  });
});
