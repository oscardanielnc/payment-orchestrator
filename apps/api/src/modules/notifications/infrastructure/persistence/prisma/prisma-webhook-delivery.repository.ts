import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { randomUUID } from 'node:crypto';
import type { WebhookDelivery as DeliveryRow } from '../../../../../generated/prisma/client';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import {
  type DeliveryPosition,
  WebhookDeliveryRepository,
} from '../../../application/ports/notification-ports';
import { type DeliveryAttempt, WebhookDelivery } from '../../../domain/webhook-delivery';

const toDomain = (row: DeliveryRow) => WebhookDelivery.restore({ ...row });

@Injectable()
export class PrismaWebhookDeliveryRepository extends WebhookDeliveryRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async insertIfAbsent(delivery: WebhookDelivery): Promise<WebhookDelivery> {
    // ON CONFLICT DO NOTHING on (endpoint_id, event_id), then read whichever row won.
    await this.txHost.tx.webhookDelivery.createMany({
      data: [
        {
          id: delivery.id,
          organizationId: delivery.organizationId,
          endpointId: delivery.endpointId,
          eventId: delivery.eventId,
          eventType: delivery.eventType,
          payload: delivery.payload,
          status: delivery.status,
          attemptCount: delivery.attemptCount,
          createdAt: delivery.createdAt,
          updatedAt: delivery.updatedAt,
        },
      ],
      skipDuplicates: true,
    });
    const row = await this.txHost.tx.webhookDelivery.findUniqueOrThrow({
      where: {
        endpointId_eventId: { endpointId: delivery.endpointId, eventId: delivery.eventId },
      },
    });
    return toDomain(row);
  }

  async save(delivery: WebhookDelivery): Promise<void> {
    const attempts = delivery.pullNewAttempts();
    await this.txHost.tx.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: delivery.status,
        attemptCount: delivery.attemptCount,
        lastStatusCode: delivery.lastStatusCode,
        lastError: delivery.lastError,
        updatedAt: delivery.updatedAt,
        deliveredAt: delivery.deliveredAt,
      },
    });
    if (attempts.length > 0) {
      await this.txHost.tx.webhookDeliveryAttempt.createMany({
        data: attempts.map((a) => ({ id: randomUUID(), deliveryId: delivery.id, ...a })),
      });
    }
  }

  async findById(id: string): Promise<WebhookDelivery | null> {
    const row = await this.txHost.tx.webhookDelivery.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findForOrganization(
    organizationId: string,
    id: string,
  ): Promise<{ delivery: WebhookDelivery; attempts: DeliveryAttempt[] } | null> {
    const row = await this.txHost.tx.webhookDelivery.findFirst({
      where: { id, organizationId },
      include: { attempts: { orderBy: { attemptedAt: 'asc' } } },
    });
    if (!row) return null;
    const { attempts, ...delivery } = row;
    return {
      delivery: toDomain(delivery),
      attempts: attempts.map((a) => ({
        attemptedAt: a.attemptedAt,
        statusCode: a.statusCode,
        error: a.error,
        durationMs: a.durationMs,
      })),
    };
  }

  async listForOrganization(
    organizationId: string,
    page: { limit: number; after: DeliveryPosition | null },
  ): Promise<{ items: WebhookDelivery[]; next: DeliveryPosition | null }> {
    const { after } = page;
    const rows = await this.txHost.tx.webhookDelivery.findMany({
      where: {
        organizationId,
        ...(after && {
          OR: [
            { createdAt: { lt: after.createdAt } },
            { createdAt: after.createdAt, id: { lt: after.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1,
    });
    const items = rows.slice(0, page.limit).map(toDomain);
    const last = items.at(-1);
    return {
      items,
      next: rows.length > page.limit && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }

  async findNeverAttempted(before: Date, limit: number): Promise<WebhookDelivery[]> {
    const rows = await this.txHost.tx.webhookDelivery.findMany({
      where: { status: 'pending', attemptCount: 0, createdAt: { lt: before } },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return rows.map(toDomain);
  }
}
