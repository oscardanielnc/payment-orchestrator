import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { IdGenerator } from '../../application/ports/id-generator';
import { Outbox, type StoredDomainEvent } from '../../application/ports/outbox';
import type { DomainEvent } from '../../domain/domain-event';
import type { Prisma } from '../../../generated/prisma/client';
import type { PrismaService } from './prisma.service';

interface OutboxRow {
  id: string;
  type: string;
  aggregate_type: string;
  aggregate_id: string;
  organization_id: string;
  payload: Record<string, unknown>;
  occurred_at: Date;
}

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

  async claimUnpublished(limit: number): Promise<StoredDomainEvent[]> {
    const rows = await this.txHost.tx.$queryRaw<OutboxRow[]>`
      SELECT id, type, aggregate_type, aggregate_id, organization_id, payload, occurred_at
      FROM outbox_events
      WHERE published_at IS NULL
      ORDER BY occurred_at
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED`;
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      aggregateType: row.aggregate_type,
      aggregateId: row.aggregate_id,
      organizationId: row.organization_id,
      payload: row.payload,
      occurredAt: row.occurred_at,
    }));
  }

  async markPublished(ids: string[], at: Date): Promise<void> {
    if (ids.length === 0) return;
    await this.txHost.tx.outboxEvent.updateMany({
      where: { id: { in: ids } },
      data: { publishedAt: at },
    });
  }

  async listForAggregate(
    organizationId: string,
    aggregateType: string,
    aggregateId: string,
  ): Promise<StoredDomainEvent[]> {
    const rows = await this.txHost.tx.outboxEvent.findMany({
      where: { organizationId, aggregateType, aggregateId },
      orderBy: { occurredAt: 'asc' },
    });
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      aggregateType: row.aggregateType,
      aggregateId: row.aggregateId,
      organizationId: row.organizationId,
      payload: row.payload as Record<string, unknown>,
      occurredAt: row.occurredAt,
    }));
  }
}
