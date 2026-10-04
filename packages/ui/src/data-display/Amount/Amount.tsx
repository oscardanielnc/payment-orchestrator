import { formatMinorUnits } from '../../lib/money';

export interface AmountProps {
  /** Minor units as a string of an integer, exactly as the API sends it. */
  value: string;
  currency: string;
  size?: 'sm' | 'hero';
}

/** Money in mono with tabular figures; the currency code is always visible (never a symbol). */
export function Amount({ value, currency, size = 'sm' }: AmountProps) {
  const big = size === 'hero';
  return (
    <span
      className={`font-mono tabular-nums ${big ? 'text-[32px] leading-[38px] font-semibold' : 'text-sm'}`}
    >
      {formatMinorUnits(value, currency)}
      <span className={`ml-1.5 text-muted ${big ? 'text-lg font-normal' : ''}`}>{currency}</span>
    </span>
  );
}
