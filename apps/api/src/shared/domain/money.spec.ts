import { CURRENCY_DECIMALS as CONTRACT_DECIMALS } from '@po/contracts';
import { describe, expect, it } from 'vitest';
import { CURRENCY_DECIMALS, CurrencyMismatchError, Money, UnsupportedCurrencyError } from './money';

describe('Money', () => {
  it('adds exactly, with no float rounding', () => {
    // 0.1 + 0.2 USD as minor units: 10 + 20 = 30, never 30.000000000000004
    const total = Money.of(10n, 'USD').add(Money.of(20n, 'USD'));

    expect(total.toMinorUnits()).toBe('30');
  });

  it('keeps precision beyond Number.MAX_SAFE_INTEGER', () => {
    const huge = Money.fromMinorUnits('9007199254740993', 'USDT');

    expect(huge.add(Money.of(1n, 'USDT')).toMinorUnits()).toBe('9007199254740994');
  });

  it('refuses to mix currencies', () => {
    expect(() => Money.of(1n, 'USD').add(Money.of(1n, 'PEN'))).toThrow(CurrencyMismatchError);
  });

  it('rejects unsupported currencies', () => {
    expect(() => Money.of(1n, 'BTC')).toThrow(UnsupportedCurrencyError);
  });

  it('knows the decimals of each currency', () => {
    expect(Money.of(1n, 'USDT').decimals).toBe(6);
    expect(Money.of(1n, 'PEN').decimals).toBe(2);
  });

  it('supports exactly the currencies the API contract accepts', () => {
    expect(CURRENCY_DECIMALS).toEqual(CONTRACT_DECIMALS);
  });
});
