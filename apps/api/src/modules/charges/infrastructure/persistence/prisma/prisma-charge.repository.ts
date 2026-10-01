import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import { ConcurrencyConflictError } from '../../../../../shared/domain/concurrency-conflict.error';
import type { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import {
  ChargePage,
  ChargePosition,
  ChargeRepository,
} from '../../../application/ports/charge.repository';
import type { Charge } from '../../../domain/charge';
import { chargeMapper } from './charge.mapper';

@Injectable()
export class PrismaChargeRepository extends ChargeRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async save(charge: Charge): Promise<void> {
    const row = chargeMapper.toRow(charge);

    if (charge.version === 0) {
      await this.txHost.tx.charge.create({ data: { ...row, version: 1 } });
      charge.markPersisted(1);
      return;
    }

    // Optimistic lock: the UPDATE only matches if nobody saved a newer version meanwhile.
    const { count } = await this.txHost.tx.charge.updateMany({
      where: { id: row.id, version: charge.version },
      data: {
        status: row.status,
        description: row.description,
        reference: row.reference,
        updatedAt: row.updatedAt,
        version: { increment: 1 },
      },
    });
    if (count === 0) throw new ConcurrencyConflictError('Charge');
    charge.markPersisted(charge.version + 1);
  }

  async findForOrganization(organizationId: string, id: string): Promise<Charge | null> {
    const row = await this.txHost.tx.charge.findFirst({ where: { id, organizationId } });
    return row ? chargeMapper.toDomain(row) : null;
  }

  async listForOrganization(
    organizationId: string,
    page: { limit: number; after: ChargePosition | null },
  ): Promise<ChargePage> {
    const { after } = page;
    const rows = await this.txHost.tx.charge.findMany({
      where: {
        organizationId,
        // Keyset: strictly after the cursor in (createdAt desc, id desc) order.
        ...(after && {
          OR: [
            { createdAt: { lt: after.createdAt } },
            { createdAt: after.createdAt, id: { lt: after.id } },
          ],
        }),
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: page.limit + 1, // one extra row tells us whether a next page exists
    });

    const items = rows.slice(0, page.limit).map((row) => chargeMapper.toDomain(row));
    const last = items.at(-1);
    return {
      items,
      next: rows.length > page.limit && last ? { createdAt: last.createdAt, id: last.id } : null,
    };
  }
}
