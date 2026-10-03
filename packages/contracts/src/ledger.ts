import { z } from 'zod';
import { CurrencyCode, MinorUnits } from './money';

/** Signed minor units: a balance can be negative, unlike a charge amount. */
const SignedMinorUnits = z.string().regex(/^-?[0-9]{1,30}$/);

export const Balance = z.object({
  account: z.string(),
  name: z.string(),
  currency: CurrencyCode,
  /** Confirmed money. */
  posted: SignedMinorUnits,
  /** Posted plus pending. */
  pending: SignedMinorUnits,
});
export type Balance = z.infer<typeof Balance>;

export const BalanceList = z.object({ data: z.array(Balance) });
export type BalanceList = z.infer<typeof BalanceList>;

export const LedgerEntry = z.object({
  transactionId: z.uuid(),
  description: z.string(),
  status: z.enum(['pending', 'posted', 'archived']),
  effectiveAt: z.iso.datetime(),
  account: z.string(),
  accountName: z.string(),
  normalBalance: z.enum(['debit', 'credit']),
  direction: z.enum(['debit', 'credit']),
  amount: MinorUnits,
  currency: CurrencyCode,
});
export type LedgerEntry = z.infer<typeof LedgerEntry>;

export const LedgerEntryList = z.object({ data: z.array(LedgerEntry) });
export type LedgerEntryList = z.infer<typeof LedgerEntryList>;
