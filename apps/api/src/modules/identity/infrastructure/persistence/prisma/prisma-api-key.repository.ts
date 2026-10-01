import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { ApiKeyRepository } from '../../../application/ports/api-key.repository';
import type { ApiKey } from '../../../domain/api-key';
import { apiKeyMapper } from './identity.mappers';

@Injectable()
export class PrismaApiKeyRepository extends ApiKeyRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async save(apiKey: ApiKey): Promise<void> {
    const row = apiKeyMapper.toRow(apiKey);
    await this.txHost.tx.apiKey.upsert({
      where: { id: row.id },
      create: row,
      update: { name: row.name, revokedAt: row.revokedAt, lastUsedAt: row.lastUsedAt },
    });
  }

  async findById(id: string): Promise<ApiKey | null> {
    const row = await this.txHost.tx.apiKey.findUnique({ where: { id } });
    return row ? apiKeyMapper.toDomain(row) : null;
  }

  async listByOrganization(organizationId: string): Promise<ApiKey[]> {
    const rows = await this.txHost.tx.apiKey.findMany({
      where: { organizationId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((row) => apiKeyMapper.toDomain(row));
  }
}
