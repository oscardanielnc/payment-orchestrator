import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { PaymentInstructions as PaymentInstructionsSchema } from '@po/contracts';
import { ConcurrencyConflictError } from '../../../../../shared/domain/concurrency-conflict.error';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type { PaymentAttempt as AttemptRow } from '../../../../../generated/prisma/client';
import { PaymentAttemptRepository } from '../../../application/ports/payment-attempt.repository';
import { PaymentAttempt } from '../../../domain/payment-attempt';
import type { PaymentMethod, ProviderId } from '../../../domain/payment-route';

function toDomain(row: AttemptRow): PaymentAttempt {
  return PaymentAttempt.restore({
    id: row.id,
    chargeId: row.chargeId,
    organizationId: row.organizationId,
    method: row.method as PaymentMethod,
    provider: row.provider as ProviderId,
    status: row.status,
    externalReference: row.externalReference,
    // JSON from the database is validated against the contract before it becomes domain data.
    instructions: PaymentInstructionsSchema.parse(row.instructions),
    failureReason: row.failureReason,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    version: row.version,
  });
}

@Injectable()
export class PrismaPaymentAttemptRepository extends PaymentAttemptRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async save(attempt: PaymentAttempt): Promise<void> {
    if (attempt.version === 0) {
      await this.txHost.tx.paymentAttempt.create({
        data: {
          id: attempt.id,
          chargeId: attempt.chargeId,
          organizationId: attempt.organizationId,
          method: attempt.method,
          provider: attempt.provider,
          status: attempt.status,
          externalReference: attempt.externalReference,
          instructions: attempt.instructions,
          failureReason: attempt.failureReason,
          createdAt: attempt.createdAt,
          updatedAt: attempt.updatedAt,
          version: 1,
        },
      });
      attempt.markPersisted(1);
      return;
    }

    const { count } = await this.txHost.tx.paymentAttempt.updateMany({
      where: { id: attempt.id, version: attempt.version },
      data: {
        status: attempt.status,
        failureReason: attempt.failureReason,
        updatedAt: attempt.updatedAt,
        version: { increment: 1 },
      },
    });
    if (count === 0) throw new ConcurrencyConflictError('PaymentAttempt');
    attempt.markPersisted(attempt.version + 1);
  }

  async findById(id: string): Promise<PaymentAttempt | null> {
    const row = await this.txHost.tx.paymentAttempt.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findByExternalReference(
    provider: string,
    externalReference: string,
  ): Promise<PaymentAttempt | null> {
    const row = await this.txHost.tx.paymentAttempt.findUnique({
      where: { provider_externalReference: { provider, externalReference } },
    });
    return row ? toDomain(row) : null;
  }

  async listForCharge(organizationId: string, chargeId: string): Promise<PaymentAttempt[]> {
    const rows = await this.txHost.tx.paymentAttempt.findMany({
      where: { organizationId, chargeId },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }
}
