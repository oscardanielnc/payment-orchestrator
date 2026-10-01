import { Injectable } from '@nestjs/common';
import { TransactionHost } from '@nestjs-cls/transactional';
import type { TransactionalAdapterPrisma } from '@nestjs-cls/transactional-adapter-prisma';
import {
  ClaimResult,
  IdempotencyStore,
  StoredResponse,
} from '../../application/ports/idempotency-store';
import type { PrismaService } from './prisma.service';

@Injectable()
export class PrismaIdempotencyStore extends IdempotencyStore {
  constructor(private readonly txHost: TransactionHost<TransactionalAdapterPrisma<PrismaService>>) {
    super();
  }

  async claim(scope: string, key: string, requestHash: string): Promise<ClaimResult> {
    // INSERT ... ON CONFLICT DO NOTHING. If another transaction holds the same key,
    // Postgres makes this statement wait until that transaction commits or rolls back.
    const { count } = await this.txHost.tx.idempotencyKey.createMany({
      data: [{ scope, key, requestHash }],
      skipDuplicates: true,
    });
    if (count === 1) return { outcome: 'claimed' };

    const existing = await this.txHost.tx.idempotencyKey.findUniqueOrThrow({
      where: { scope_key: { scope, key } },
    });
    if (existing.responseStatus === null) {
      // Cannot happen with claim+complete in one transaction; fail loudly if it ever does.
      throw new Error('Idempotency key claimed without a stored response');
    }
    return {
      outcome: 'replay',
      requestHash: existing.requestHash,
      response: {
        statusCode: existing.responseStatus,
        body: JSON.parse(existing.responseBody ?? 'null') as unknown,
      },
    };
  }

  async complete(scope: string, key: string, response: StoredResponse): Promise<void> {
    await this.txHost.tx.idempotencyKey.update({
      where: { scope_key: { scope, key } },
      data: {
        responseStatus: response.statusCode,
        responseBody: JSON.stringify(response.body),
      },
    });
  }
}
