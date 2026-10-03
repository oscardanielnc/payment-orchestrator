import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import type { InboundEvent as InboundEventRow } from '../../../../../generated/prisma/client';
import { InboundEventRepository } from '../../../application/ports/inbound-ports';
import type { InboundEvent } from '../../../domain/inbound-event';

const toDomain = (row: InboundEventRow): InboundEvent => ({ ...row });

@Injectable()
export class PrismaInboundEventRepository extends InboundEventRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async insertIfNew(event: InboundEvent): Promise<{ event: InboundEvent; created: boolean }> {
    const { count } = await this.txHost.tx.inboundEvent.createMany({
      data: [event],
      skipDuplicates: true,
    });
    if (count === 1) return { event, created: true };
    const existing = await this.txHost.tx.inboundEvent.findUniqueOrThrow({
      where: { provider_externalId: { provider: event.provider, externalId: event.externalId } },
    });
    return { event: toDomain(existing), created: false };
  }

  async findById(id: string): Promise<InboundEvent | null> {
    const row = await this.txHost.tx.inboundEvent.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findStaleReceived(receivedBefore: Date): Promise<string[]> {
    const rows = await this.txHost.tx.inboundEvent.findMany({
      where: { status: 'received', receivedAt: { lt: receivedBefore } },
      select: { id: true },
      orderBy: { receivedAt: 'asc' },
      take: 500,
    });
    return rows.map((row) => row.id);
  }

  async markHandled(id: string, status: 'processed' | 'ignored', at: Date): Promise<void> {
    await this.txHost.tx.inboundEvent.update({
      where: { id },
      data: { status, processedAt: at, lastError: null },
    });
  }

  async recordFailure(id: string, error: string, attempts: number, final: boolean): Promise<void> {
    await this.txHost.tx.inboundEvent.update({
      where: { id },
      data: { attempts, lastError: error.slice(0, 2000), ...(final && { status: 'failed' }) },
    });
  }
}
