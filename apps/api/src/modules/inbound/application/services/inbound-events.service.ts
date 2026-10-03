import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { JobQueue, QUEUES } from '../../../../shared/application/ports/job-queue';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import type { InboundEvent } from '../../domain/inbound-event';
import { InboundEventRepository } from '../ports/inbound-ports';

/**
 * Public API of the inbound module: store an external event once, then hand it to the queue.
 *   new event              → store + enqueue
 *   duplicate, unprocessed → enqueue again (a previous enqueue may have failed; jobId dedupes)
 *   duplicate, handled     → nothing
 */
@Injectable()
export class InboundEventsService {
  constructor(
    private readonly events: InboundEventRepository,
    private readonly queue: JobQueue,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  async receive(input: {
    provider: string;
    externalId: string;
    type: string;
    payload: string;
  }): Promise<{ eventId: string; duplicate: boolean }> {
    const { event, created } = await this.transaction.run(() =>
      this.events.insertIfNew({
        id: this.ids.uuid(),
        ...input,
        status: 'received',
        attempts: 0,
        lastError: null,
        receivedAt: this.clock.now(),
        processedAt: null,
      }),
    );
    // Enqueue only AFTER the commit: a job enqueued inside the transaction can reach the worker
    // before the row is visible. If enqueueing fails here, the event stays `received` and
    // `requeueStale` picks it up.
    if (created || event.status === 'received') await this.enqueue(event.id);
    return { eventId: event.id, duplicate: !created };
  }

  /** Re-enqueues events left `received` (a lost enqueue, a crash). jobId keeps it idempotent. */
  async requeueStale(olderThanMs: number): Promise<number> {
    const ids = await this.events.findStaleReceived(
      new Date(this.clock.now().getTime() - olderThanMs),
    );
    for (const id of ids) await this.enqueue(id);
    return ids.length;
  }

  private enqueue(eventId: string): Promise<void> {
    return this.queue.enqueue(QUEUES.inboundEvents, eventId, { inboundEventId: eventId });
  }

  load(id: string): Promise<InboundEvent | null> {
    return this.events.findById(id);
  }

  markHandled(id: string, status: 'processed' | 'ignored'): Promise<void> {
    return this.events.markHandled(id, status, this.clock.now());
  }

  recordFailure(id: string, error: string, attempts: number, final: boolean): Promise<void> {
    return this.events.recordFailure(id, error, attempts, final);
  }
}
