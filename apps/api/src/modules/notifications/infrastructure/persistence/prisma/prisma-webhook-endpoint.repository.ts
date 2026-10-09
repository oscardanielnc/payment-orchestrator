import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import type { WebhookEndpoint as EndpointRow } from '../../../../../generated/prisma/client';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { WebhookEndpointRepository } from '../../../application/ports/notification-ports';
import { WebhookEndpoint } from '../../../domain/webhook-endpoint';

const toDomain = (row: EndpointRow) => WebhookEndpoint.restore({ ...row });

@Injectable()
export class PrismaWebhookEndpointRepository extends WebhookEndpointRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async save(endpoint: WebhookEndpoint): Promise<void> {
    const row = {
      id: endpoint.id,
      organizationId: endpoint.organizationId,
      url: endpoint.url,
      secretCiphertext: endpoint.secretCiphertext,
      createdAt: endpoint.createdAt,
      disabledAt: endpoint.disabledAt,
    };
    await this.txHost.tx.webhookEndpoint.upsert({
      where: { id: row.id },
      create: row,
      update: { disabledAt: row.disabledAt },
    });
  }

  async findById(id: string): Promise<WebhookEndpoint | null> {
    const row = await this.txHost.tx.webhookEndpoint.findUnique({ where: { id } });
    return row ? toDomain(row) : null;
  }

  async findForOrganization(organizationId: string, id: string): Promise<WebhookEndpoint | null> {
    const row = await this.txHost.tx.webhookEndpoint.findFirst({ where: { id, organizationId } });
    return row ? toDomain(row) : null;
  }

  async listForOrganization(organizationId: string): Promise<WebhookEndpoint[]> {
    const rows = await this.txHost.tx.webhookEndpoint.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDomain);
  }

  async listEnabledForOrganization(organizationId: string): Promise<WebhookEndpoint[]> {
    const rows = await this.txHost.tx.webhookEndpoint.findMany({
      where: { organizationId, disabledAt: null },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toDomain);
  }
}
