/** Decimals of each currency's minor unit (ADR 0005). Kept in sync with @po/contracts. */
const DECIMALS: Record<string, number> = { USD: 2, PEN: 2, USDT: 6, USDC: 6 };

/**
 * Minor units (string of an integer) → display string, with string arithmetic only: money never
 * passes through a JavaScript float. Shows at least 2 decimals and trims extra trailing zeros.
 *   formatMinorUnits('10000000', 'USDT') → '10.00'
 *   formatMinorUnits('1234567', 'USDT')  → '1.234567'
 *   formatMinorUnits('250000', 'USD')    → '2,500.00'
 */
export function formatMinorUnits(amount: string, currency: string): string {
  const decimals = DECIMALS[currency] ?? 2;
  const negative = amount.startsWith('-');
  const digits = (negative ? amount.slice(1) : amount).padStart(decimals + 1, '0');
  const whole = digits.slice(0, digits.length - decimals);
  let fraction = digits.slice(digits.length - decimals);
  while (fraction.length > 2 && fraction.endsWith('0')) fraction = fraction.slice(0, -1);

  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${negative ? '-' : ''}${grouped}${fraction ? `.${fraction}` : ''}`;
}
