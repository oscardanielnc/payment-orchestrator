import { describe, expect, it } from 'vitest';
import { formatMinorUnits, parseMajorUnits } from './money';

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

describe('parseMajorUnits', () => {
  it.each([
    ['19.99', 'USD', '1999'],
    ['1,250', 'USD', '125000'],
    ['10', 'USDT', '10000000'],
    ['0.000001', 'USDT', '1'],
    ['  7.5 ', 'PEN', '750'],
  ])('%s %s → %s', (input, currency, expected) => {
    expect(parseMajorUnits(input, currency)).toBe(expected);
  });

  it.each([['0'], ['0.00'], ['-5'], ['1.234'], ['abc'], [''], ['1e3']])(
    'rejects %j for USD',
    (input) => {
      expect(parseMajorUnits(input, 'USD')).toBeNull();
    },
  );
});
