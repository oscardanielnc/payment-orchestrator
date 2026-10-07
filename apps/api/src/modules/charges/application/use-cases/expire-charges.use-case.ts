import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { Outbox } from '../../../../shared/application/ports/outbox';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import { ConcurrencyConflictError } from '../../../../shared/domain/concurrency-conflict.error';
import { ChargeRepository } from '../ports/charge.repository';

const BATCH = 100;

/**
 * Moves pending charges past their expiry to `expired` (with its `charge.expired` event).
 * Each charge commits on its own: if a customer starts paying at the same moment, the
 * optimistic lock makes one of the two lose, and losing here just means "not expired".
 * Charges already in `processing` are left alone: a payment may still be on its way.
 */
@Injectable()
export class ExpireChargesUseCase {
  constructor(
    private readonly charges: ChargeRepository,
    private readonly outbox: Outbox,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  async execute(): Promise<number> {
    const now = this.clock.now();
    const due = await this.charges.findPendingExpiredAt(now, BATCH);
    let expired = 0;

    for (const charge of due) {
      try {
        await this.transaction.run(async () => {
          charge.expire(now);
          await this.charges.save(charge);
          await this.outbox.add(charge.pullEvents());
        });
        expired += 1;
      } catch (error) {
        if (!(error instanceof ConcurrencyConflictError)) throw error;
      }
    }
    return expired;
  }
}
