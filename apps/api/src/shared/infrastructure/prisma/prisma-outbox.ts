import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { IdGenerator } from '../../application/ports/id-generator';
import { Outbox } from '../../application/ports/outbox';
import type { DomainEvent } from '../../domain/domain-event';
import type { Prisma } from '../../../generated/prisma/client';
import type { PrismaService } from './prisma.service';

@Injectable()
export class PrismaOutbox extends Outbox {
  constructor(
    private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>,
    private readonly ids: IdGenerator,
  ) {
    super();
  }

  async add(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) return;
    await this.txHost.tx.outboxEvent.createMany({
      data: events.map((event) => ({
        id: this.ids.uuid(),
        type: event.type,
        aggregateType: event.aggregateType,
        aggregateId: event.aggregateId,
        organizationId: event.organizationId,
        payload: event.payload as Prisma.InputJsonObject,
        occurredAt: event.occurredAt,
      })),
    });
  }
}
