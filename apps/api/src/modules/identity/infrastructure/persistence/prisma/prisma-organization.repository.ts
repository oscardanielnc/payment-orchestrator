import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { OrganizationRepository } from '../../../application/ports/organization.repository';
import type { Organization } from '../../../domain/organization';
import { organizationMapper } from './identity.mappers';

@Injectable()
export class PrismaOrganizationRepository extends OrganizationRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async save(organization: Organization): Promise<void> {
    const row = organizationMapper.toRow(organization);
    await this.txHost.tx.organization.upsert({
      where: { id: row.id },
      create: row,
      update: { name: row.name },
    });
  }

  async findById(id: string): Promise<Organization | null> {
    const row = await this.txHost.tx.organization.findUnique({ where: { id } });
    return row ? organizationMapper.toDomain(row) : null;
  }
}
