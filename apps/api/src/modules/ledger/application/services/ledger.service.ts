import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { Money } from '../../../../shared/domain/money';
import {
  balanceOf,
  type Direction,
  type LedgerAccount,
  type LedgerAccountRef,
} from '../../domain/ledger-account';
import { LedgerTransaction } from '../../domain/ledger-transaction';
import {
  type AccountActivity,
  type AccountActivityQuery,
  LedgerAccountRepository,
  LedgerActivityReader,
  LedgerBalanceReader,
  LedgerTransactionRepository,
} from '../ports/ledger-repositories';

export interface PostingLine {
  account: LedgerAccountRef;
  direction: Direction;
  amount: Money;
}

export interface PostInput {
  /** One business event → one ledger transaction. Repeating it returns the original. */
  externalId: string;
  organizationId: string | null;
  reference: string | null;
  description: string;
  lines: PostingLine[];
  status?: 'pending' | 'posted';
}

export interface AccountBalance {
  account: LedgerAccount;
  posted: Money;
  /** Posted plus pending. */
  pending: Money;
}

export interface EntryView {
  transactionId: string;
  description: string;
  status: string;
  effectiveAt: Date;
  accountCode: string;
  accountName: string;
  normalBalance: string;
  direction: Direction;
  amount: Money;
}

/**
 * Public API of the ledger module. Generic on purpose: it knows accounts, entries and
 * balances, not charges or crypto. Callers decide which accounts a business event moves.
 * Must run inside the caller's unit of work so money and state change together.
 */
@Injectable()
export class LedgerService {
  constructor(
    private readonly accounts: LedgerAccountRepository,
    private readonly transactions: LedgerTransactionRepository,
    private readonly balances: LedgerBalanceReader,
    private readonly activity: LedgerActivityReader,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
  ) {}

  async post(input: PostInput): Promise<{ transaction: LedgerTransaction; created: boolean }> {
    const existing = await this.transactions.findByExternalId(input.externalId);
    if (existing) return { transaction: existing, created: false };

    const entries = [];
    for (const line of input.lines) {
      const account = await this.accounts.findOrCreate(line.account);
      entries.push({ accountId: account.id, direction: line.direction, amount: line.amount });
    }
    const transaction = LedgerTransaction.record({
      id: this.ids.uuid(),
      externalId: input.externalId,
      organizationId: input.organizationId,
      reference: input.reference,
      description: input.description,
      entries,
      status: input.status ?? 'posted',
      now: this.clock.now(),
    });
    await this.transactions.insert(transaction);
    return { transaction, created: true };
  }

  /** Net movement per business key on one account code (read-only; for reconciliation). */
  netDebits(query: AccountActivityQuery): Promise<AccountActivity[]> {
    return this.activity.netDebits(query);
  }

  async balancesFor(organizationId: string): Promise<AccountBalance[]> {
    const accounts = await this.accounts.listForOrganization(organizationId);
    const totals = await this.balances.totals(accounts.map((a) => a.id));
    return accounts.map((account) => {
      const t = totals.get(account.id) ?? {
        postedDebits: 0n,
        postedCredits: 0n,
        pendingDebits: 0n,
        pendingCredits: 0n,
      };
      const posted = balanceOf(account.normalBalance, t.postedDebits, t.postedCredits);
      const pending = balanceOf(account.normalBalance, t.pendingDebits, t.pendingCredits);
      return {
        account,
        posted: Money.of(posted, account.currency),
        pending: Money.of(posted + pending, account.currency),
      };
    });
  }

  async entriesFor(organizationId: string, reference: string): Promise<EntryView[]> {
    const transactions = await this.transactions.listByReference(organizationId, reference);
    const accountIds = [...new Set(transactions.flatMap((t) => t.entries.map((e) => e.accountId)))];
    const byId = new Map((await this.accounts.findByIds(accountIds)).map((a) => [a.id, a]));

    return transactions.flatMap((transaction) =>
      transaction.entries.map((entry) => {
        const account = byId.get(entry.accountId);
        if (!account) throw new Error(`Ledger entry points to missing account ${entry.accountId}`);
        return {
          transactionId: transaction.id,
          description: transaction.description,
          status: transaction.status,
          effectiveAt: transaction.effectiveAt,
          accountCode: account.code,
          accountName: account.name,
          normalBalance: account.normalBalance,
          direction: entry.direction,
          amount: entry.amount,
        };
      }),
    );
  }
}
