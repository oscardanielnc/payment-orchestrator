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

export interface AccountActivityQuery {
  /** Every account with this code, in any currency (e.g. `platform:stripe:receivable`). */
  accountCode: string;
  groupBy: 'externalId' | 'reference';
  /** Keys with a transaction effective in [from, to), totalled over all time. */
  window?: { from: Date; to: Date };
  /** And/or these keys, whenever they happened. */
  keys?: string[];
}

export interface AccountActivity {
  key: string;
  organizationId: string | null;
  reference: string | null;
  currency: string;
  /** Posted debits minus posted credits: a reversal cancels what it reverses. */
  netDebits: bigint;
}

/** Read-only totals for reconciliation and reports. */
export abstract class LedgerActivityReader {
  abstract netDebits(query: AccountActivityQuery): Promise<AccountActivity[]>;
}

/** Balances are SUMs over entries, never a stored number (ADR 0009). */
export abstract class LedgerBalanceReader {
  abstract totals(accountIds: string[]): Promise<Map<string, AccountTotals>>;
}
