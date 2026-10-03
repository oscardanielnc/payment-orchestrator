import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { IdGenerator } from '../../../../../shared/application/ports/id-generator';
import { Money } from '../../../../../shared/domain/money';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import {
  Prisma,
  type LedgerAccount as AccountRow,
  type LedgerEntry as EntryRow,
  type LedgerTransaction as TransactionRow,
} from '../../../../../generated/prisma/client';
import {
  AccountTotals,
  LedgerAccountRepository,
  LedgerBalanceReader,
  LedgerTransactionRepository,
} from '../../../application/ports/ledger-repositories';
import type { LedgerAccount, LedgerAccountRef } from '../../../domain/ledger-account';
import { LedgerTransaction } from '../../../domain/ledger-transaction';

const toAccount = (row: AccountRow): LedgerAccount => ({
  id: row.id,
  code: row.code,
  currency: row.currency,
  name: row.name,
  normalBalance: row.normalBalance,
  organizationId: row.organizationId,
});

const toTransaction = (row: TransactionRow & { entries: EntryRow[] }): LedgerTransaction =>
  LedgerTransaction.restore({
    id: row.id,
    externalId: row.externalId,
    organizationId: row.organizationId,
    reference: row.reference,
    description: row.description,
    status: row.status,
    effectiveAt: row.effectiveAt,
    postedAt: row.postedAt,
    entries: row.entries.map((entry) => ({
      accountId: entry.accountId,
      direction: entry.direction,
      amount: Money.fromMinorUnits(entry.amount.toFixed(0), entry.currency),
    })),
  });

@Injectable()
export class PrismaLedgerAccountRepository extends LedgerAccountRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  async findOrCreate(ref: LedgerAccountRef): Promise<LedgerAccount> {
    const row = await this.txHost.tx.ledgerAccount.upsert({
      where: { code_currency: { code: ref.code, currency: ref.currency } },
      create: { id: this.ids.uuid(), ...ref },
      update: {},
    });
    return toAccount(row);
  }

  async listForOrganization(organizationId: string): Promise<LedgerAccount[]> {
    const rows = await this.txHost.tx.ledgerAccount.findMany({
      where: { organizationId },
      orderBy: [{ currency: 'asc' }, { code: 'asc' }],
    });
    return rows.map(toAccount);
  }

  async findByIds(ids: string[]): Promise<LedgerAccount[]> {
    if (ids.length === 0) return [];
    return (await this.txHost.tx.ledgerAccount.findMany({ where: { id: { in: ids } } })).map(
      toAccount,
    );
  }
}

@Injectable()
export class PrismaLedgerTransactionRepository extends LedgerTransactionRepository {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  async findByExternalId(externalId: string): Promise<LedgerTransaction | null> {
    const row = await this.txHost.tx.ledgerTransaction.findUnique({
      where: { externalId },
      include: { entries: true },
    });
    return row ? toTransaction(row) : null;
  }

  async insert(transaction: LedgerTransaction): Promise<void> {
    await this.txHost.tx.ledgerTransaction.create({
      data: {
        id: transaction.id,
        externalId: transaction.externalId,
        organizationId: transaction.organizationId,
        reference: transaction.reference,
        description: transaction.description,
        status: transaction.status,
        effectiveAt: transaction.effectiveAt,
        postedAt: transaction.postedAt,
        entries: {
          create: transaction.entries.map((entry) => ({
            id: this.ids.uuid(),
            accountId: entry.accountId,
            direction: entry.direction,
            amount: new Prisma.Decimal(entry.amount.toMinorUnits()),
            currency: entry.amount.currency,
          })),
        },
      },
    });
  }

  async listByReference(organizationId: string, reference: string): Promise<LedgerTransaction[]> {
    const rows = await this.txHost.tx.ledgerTransaction.findMany({
      where: { organizationId, reference },
      include: { entries: true },
      orderBy: { effectiveAt: 'asc' },
    });
    return rows.map(toTransaction);
  }
}

@Injectable()
export class PrismaLedgerBalanceReader extends LedgerBalanceReader {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async totals(accountIds: string[]): Promise<Map<string, AccountTotals>> {
    const result = new Map<string, AccountTotals>();
    if (accountIds.length === 0) return result;

    // Sums as text so NUMERIC(78,0) never passes through a JavaScript number.
    const rows = await this.txHost.tx.$queryRaw<
      { account_id: string; direction: string; status: string; total: string }[]
    >`
      SELECT e.account_id, e.direction::text AS direction, t.status::text AS status,
             SUM(e.amount)::text AS total
      FROM ledger_entries e
      JOIN ledger_transactions t ON t.id = e.transaction_id
      WHERE e.account_id::text = ANY(${accountIds}) AND t.status <> 'archived'
      GROUP BY e.account_id, e.direction, t.status`;

    for (const row of rows) {
      const totals = result.get(row.account_id) ?? {
        postedDebits: 0n,
        postedCredits: 0n,
        pendingDebits: 0n,
        pendingCredits: 0n,
      };
      const amount = BigInt(row.total);
      const key =
        `${row.status === 'posted' ? 'posted' : 'pending'}${row.direction === 'debit' ? 'Debits' : 'Credits'}` as keyof AccountTotals;
      totals[key] += amount;
      result.set(row.account_id, totals);
    }
    return result;
  }
}
