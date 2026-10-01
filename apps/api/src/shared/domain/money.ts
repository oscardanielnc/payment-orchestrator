import { DomainError } from './domain-error';

/** Decimals of each supported currency's minor unit (ADR 0005). */
export const CURRENCY_DECIMALS: Readonly<Record<string, number>> = {
  USD: 2,
  PEN: 2,
  USDT: 6,
  USDC: 6,
};

export class UnsupportedCurrencyError extends DomainError {
  readonly code = 'money.unsupported_currency';

  constructor(currency: string) {
    super(`Currency ${currency} is not supported`);
  }
}

export class CurrencyMismatchError extends DomainError {
  readonly code = 'money.currency_mismatch';

  constructor() {
    super('Cannot combine amounts in different currencies');
  }
}

/**
 * An integer amount of minor units plus its currency. Never a float:
 * 10 USDT is `Money.of(10_000_000n, 'USDT')`.
 */
export class Money {
  private constructor(
    readonly amount: bigint,
    readonly currency: string,
  ) {}

  static of(amount: bigint, currency: string): Money {
    if (CURRENCY_DECIMALS[currency] === undefined) throw new UnsupportedCurrencyError(currency);
    return new Money(amount, currency);
  }

  /** Parses the API representation: a string of digits in minor units. */
  static fromMinorUnits(amount: string, currency: string): Money {
    if (!/^-?[0-9]+$/.test(amount)) throw new Error(`Not an integer amount: ${amount}`);
    return Money.of(BigInt(amount), currency);
  }

  get decimals(): number {
    return CURRENCY_DECIMALS[this.currency] ?? 0;
  }

  isPositive(): boolean {
    return this.amount > 0n;
  }

  add(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount + other.amount, this.currency);
  }

  subtract(other: Money): Money {
    this.assertSameCurrency(other);
    return new Money(this.amount - other.amount, this.currency);
  }

  equals(other: Money): boolean {
    return this.currency === other.currency && this.amount === other.amount;
  }

  /** Minor units as a string, the way the API and JSON transport money. */
  toMinorUnits(): string {
    return this.amount.toString();
  }

  private assertSameCurrency(other: Money): void {
    if (other.currency !== this.currency) throw new CurrencyMismatchError();
  }
}
