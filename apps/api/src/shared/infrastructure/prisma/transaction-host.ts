import type { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import type { PrismaService } from './prisma.service';

/** What repositories use: `tx` is the current transaction, or the plain client outside one. */
export type PrismaTransactionHost = TransactionHost<TransactionalAdapterPrisma<PrismaService>>;
