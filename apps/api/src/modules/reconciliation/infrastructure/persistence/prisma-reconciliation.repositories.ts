import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  Prisma,
  type ReconciliationFinding as FindingRow,
} from '../../../../generated/prisma/client';
import { ConcurrencyConflictError } from '../../../../shared/domain/concurrency-conflict.error';
import type { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  type FindingPosition,
  FindingRepository,
  type ReconciliationRun,
  ReconciliationRunRepository,
} from '../../application/ports/reconciliation-ports';
import { Finding, type FindingStatus } from '../../domain/finding';
import type { ReconWindow } from '../../domain/window';

const decimal = (value: bigint) => new Prisma.Decimal(value.toString());

const toDomain = (row: FindingRow) =>
  Finding.restore({
    ...row,
    providerAmount: BigInt(row.providerAmount.toFixed(0)),
    ledgerAmount: BigInt(row.ledgerAmount.toFixed(0)),
  });

@Injectable()
export class PrismaFindingRepository extends FindingRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async save(finding: Finding): Promise<void> {
    const data = {
      kind: finding.kind,
      currency: finding.currency,
      providerAmount: decimal(finding.providerAmount),
      ledgerAmount: decimal(finding.ledgerAmount),
      status: finding.status,
      lastSeenAt: finding.lastSeenAt,
      resolvedAt: finding.resolvedAt,
      resolvedBy: finding.resolvedBy,
      note: finding.note,
    };
    if (finding.version === 0) {
      await this.txHost.tx.reconciliationFinding.create({
        data: {
          ...data,
          id: finding.id,
          source: finding.source,
          subject: finding.subject,
          organizationId: finding.organizationId,
          chargeId: finding.chargeId,
          firstSeenAt: finding.firstSeenAt,
          version: 1,
        },
      });
      finding.markPersisted(1);
      return;
    }
    const { count } = await this.txHost.tx.reconciliationFinding.updateMany({
      where: { id: finding.id, version: finding.version },
      data: { ...data, version: { increment: 1 } },
    });
    if (count === 0) throw new ConcurrencyConflictError('ReconciliationFinding');
    finding.markPersisted(finding.version + 1);
  }

  async findBySubjects(source: string, subjects: string[]): Promise<Finding[]> {
    if (subjects.length === 0) return [];
    const rows = await this.txHost.tx.reconciliationFinding.findMany({
      where: { source, subject: { in: subjects } },
    });
    return rows.map(toDomain);
  }

  async findForOrganization(organizationId: string, id: string): Promise<Finding | null> {
    const row = await this.txHost.tx.reconciliationFinding.findFirst({
      where: { id, organizationId },
    });
    return row ? toDomain(row) : null;
  }

  async listForOrganization(query: {
    organizationId: string;
    status: FindingStatus | undefined;
    limit: number;
    after: FindingPosition | null;
  }): Promise<{ items: Finding[]; next: FindingPosition | null }> {
    const { after } = query;
    const rows = await this.txHost.tx.reconciliationFinding.findMany({
      where: {
        organizationId: query.organizationId,
        ...(query.status && { status: query.status }),
        ...(after && {
          OR: [
            { firstSeenAt: { lt: after.firstSeenAt } },
            { firstSeenAt: after.firstSeenAt, id: { lt: after.id } },
          ],
        }),
      },
      orderBy: [{ firstSeenAt: 'desc' }, { id: 'desc' }],
      take: query.limit + 1,
    });
    const items = rows.slice(0, query.limit).map(toDomain);
    const last = items.at(-1);
    return {
      items,
      next:
        rows.length > query.limit && last ? { firstSeenAt: last.firstSeenAt, id: last.id } : null,
    };
  }
}

@Injectable()
export class PrismaReconciliationRunRepository extends ReconciliationRunRepository {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async save(run: ReconciliationRun): Promise<void> {
    const counts = { matched: run.matched, discrepancies: run.discrepancies, ranAt: run.ranAt };
    await this.txHost.tx.reconciliationRun.upsert({
      where: {
        source_windowStart_windowEnd: {
          source: run.source,
          windowStart: run.window.from,
          windowEnd: run.window.to,
        },
      },
      create: {
        source: run.source,
        windowStart: run.window.from,
        windowEnd: run.window.to,
        ...counts,
      },
      update: counts,
    });
  }

  async exists(source: string, window: ReconWindow): Promise<boolean> {
    const row = await this.txHost.tx.reconciliationRun.findUnique({
      where: {
        source_windowStart_windowEnd: { source, windowStart: window.from, windowEnd: window.to },
      },
    });
    return row !== null;
  }
}
