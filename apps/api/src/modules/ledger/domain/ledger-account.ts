/**
 * Debit-normal accounts (assets) grow with debits; credit-normal accounts (liabilities,
 * revenue) grow with credits. It decides the sign of a balance, never the entries.
 */
export type NormalBalance = 'debit' | 'credit';
export type Direction = 'debit' | 'credit';

/** How callers name an account. It is created on first use. */
export interface LedgerAccountRef {
  /** Stable, readable id, e.g. `merchant:<orgId>:available`. Unique together with currency. */
  code: string;
  currency: string;
  name: string;
  normalBalance: NormalBalance;
  /** Owner of the money; null for platform accounts. */
  organizationId: string | null;
}

export interface LedgerAccount extends LedgerAccountRef {
  id: string;
}

/** Balance in minor units, signed so that a "normal" balance is positive. */
export function balanceOf(normal: NormalBalance, debits: bigint, credits: bigint): bigint {
  return normal === 'debit' ? debits - credits : credits - debits;
}
