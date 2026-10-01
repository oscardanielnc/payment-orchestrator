import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConcurrencyConflictError } from '../../../../../shared/domain/concurrency-conflict.error';
import { Money } from '../../../../../shared/domain/money';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { Prisma, type DepositAddress as DepositRow } from '../../../../../generated/prisma/client';
import {
  ChainTransferRepository,
  DepositAddressRepository,
  WatcherCursorRepository,
} from '../../../application/ports/crypto-repositories';
import type { ChainTransfer } from '../../../domain/chain-transfer';
import { DepositAddress } from '../../../domain/deposit-address';
import type { CryptoNetwork } from '../../../domain/network';

/** One Postgres sequence per network (see the migration). */
const INDEX_SEQUENCE: Record<CryptoNetwork, string> = {
  'tron-nile': 'deposit_index_tron_nile',
  'base-sepolia': 'deposit_index_base_sepolia',
};

function toDomain(row: DepositRow): DepositAddress {
  return DepositAddress.restore({
    id: row.id,
    network: row.network as CryptoNetwork,
    address: row.address,
    matchKey: row.matchKey,
    derivationIndex: row.derivationIndex,
    attemptId: row.attemptId,
    chargeId: row.chargeId,
    organizationId: row.organizationId,
    expected: Money.fromMinorUnits(row.expectedAmount.toFixed(0), row.currency),
    received: Money.fromMinorUnits(row.receivedAmount.toFixed(0), row.currency),
    createdAt: row.createdAt,
    version: row.version,
  });
}

@Injectable()
export class PrismaDepositAddressRepository extends DepositAddressRepository {
  // Spelled out (not a type alias): decorator metadata needs the TransactionHost class itself.
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async nextDerivationIndex(network: CryptoNetwork): Promise<number> {
    const [row] = await this.txHost.tx.$queryRawUnsafe<{ index: bigint }[]>(
      `SELECT nextval('"${INDEX_SEQUENCE[network]}"') AS index`,
    );
    if (row === undefined) throw new Error('Sequence returned no value');
    return Number(row.index);
  }

  async save(deposit: DepositAddress): Promise<void> {
    const received = new Prisma.Decimal(deposit.received.toMinorUnits());
    if (deposit.version === 0) {
      await this.txHost.tx.depositAddress.create({
        data: {
          id: deposit.id,
          network: deposit.network,
          address: deposit.address,
          matchKey: deposit.matchKey,
          derivationIndex: deposit.derivationIndex,
          attemptId: deposit.attemptId,
          chargeId: deposit.chargeId,
          organizationId: deposit.organizationId,
          currency: deposit.expected.currency,
          expectedAmount: new Prisma.Decimal(deposit.expected.toMinorUnits()),
          receivedAmount: received,
          createdAt: deposit.createdAt,
          version: 1,
        },
      });
      deposit.markPersisted(1);
      return;
    }
    const { count } = await this.txHost.tx.depositAddress.updateMany({
      where: { id: deposit.id, version: deposit.version },
      data: { receivedAmount: received, version: { increment: 1 } },
    });
    if (count === 0) throw new ConcurrencyConflictError('DepositAddress');
    deposit.markPersisted(deposit.version + 1);
  }

  async findByMatchKeys(network: CryptoNetwork, matchKeys: string[]): Promise<DepositAddress[]> {
    if (matchKeys.length === 0) return [];
    const rows = await this.txHost.tx.depositAddress.findMany({
      where: { network, matchKey: { in: matchKeys } },
    });
    return rows.map(toDomain);
  }

  async findByMatchKey(network: CryptoNetwork, matchKey: string): Promise<DepositAddress | null> {
    const row = await this.txHost.tx.depositAddress.findUnique({
      where: { network_matchKey: { network, matchKey } },
    });
    return row ? toDomain(row) : null;
  }
}

@Injectable()
export class PrismaChainTransferRepository extends ChainTransferRepository {
  // Spelled out (not a type alias): decorator metadata needs the TransactionHost class itself.
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async recordIfNew(transfer: ChainTransfer, depositAddressId: string): Promise<boolean> {
    const { count } = await this.txHost.tx.chainTransfer.createMany({
      data: [
        {
          network: transfer.network,
          txHash: transfer.txHash,
          eventIndex: transfer.eventIndex,
          depositAddressId,
          fromMatchKey: transfer.fromMatchKey,
          amount: new Prisma.Decimal(transfer.amount.toString()),
          blockNumber: transfer.blockNumber,
          blockTimestamp: transfer.blockTimestamp,
        },
      ],
      skipDuplicates: true,
    });
    return count === 1;
  }
}

@Injectable()
export class PrismaWatcherCursorRepository extends WatcherCursorRepository {
  // Spelled out (not a type alias): decorator metadata needs the TransactionHost class itself.
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async get(network: CryptoNetwork): Promise<string | null> {
    const row = await this.txHost.tx.watcherCursor.findUnique({ where: { network } });
    return row?.cursor ?? null;
  }

  async set(network: CryptoNetwork, cursor: string): Promise<void> {
    await this.txHost.tx.watcherCursor.upsert({
      where: { network },
      create: { network, cursor },
      update: { cursor },
    });
  }
}
