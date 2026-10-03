import type { LedgerAccount, LedgerAccountRef } from '../../domain/ledger-account';
import type { LedgerTransaction } from '../../domain/ledger-transaction';

export abstract class LedgerAccountRepository {
  /** Returns the account with this (code, currency), creating it on first use. */
  abstract findOrCreate(ref: LedgerAccountRef): Promise<LedgerAccount>;
  abstract listForOrganization(organizationId: string): Promise<LedgerAccount[]>;
  abstract findByIds(ids: string[]): Promise<LedgerAccount[]>;
}

export abstract class LedgerTransactionRepository {
  abstract findByExternalId(externalId: string): Promise<LedgerTransaction | null>;
  /** Inserts the transaction with all its entries. Never updates entries. */
  abstract insert(transaction: LedgerTransaction): Promise<void>;
  abstract listByReference(organizationId: string, reference: string): Promise<LedgerTransaction[]>;
}

export interface AccountTotals {
  postedDebits: bigint;
  postedCredits: bigint;
  pendingDebits: bigint;
  pendingCredits: bigint;
}

/** Balances are SUMs over entries, never a stored number (ADR 0009). */
export abstract class LedgerBalanceReader {
  abstract totals(accountIds: string[]): Promise<Map<string, AccountTotals>>;
}
