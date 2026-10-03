import { Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { Clock } from '../shared/application/ports/clock';
import { JobQueue, QUEUES } from '../shared/application/ports/job-queue';
import { Outbox } from '../shared/application/ports/outbox';
import { TransactionRunner } from '../shared/application/ports/transaction-runner';

const BATCH_SIZE = 100;
const IDLE_DELAY_MS = 1000;

/**
 * Outbox relay (ADR 0008): moves committed events from Postgres to the domain-events queue.
 * Claim (SKIP LOCKED) → enqueue (jobId = event id) → mark published, in one transaction.
 * If the process dies after enqueueing but before committing, the event is relayed again;
 * the jobId keeps that duplicate from running twice while the first job exists.
 */
@Injectable()
export class OutboxRelayService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(OutboxRelayService.name);
  private timer: NodeJS.Timeout | undefined;
  private stopped = false;

  constructor(
    private readonly outbox: Outbox,
    private readonly queue: JobQueue,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  onApplicationBootstrap(): void {
    this.schedule(0);
  }

  onApplicationShutdown(): void {
    this.stopped = true;
    clearTimeout(this.timer);
  }

  /** One batch. Returns how many events were published. */
  relayOnce(): Promise<number> {
    return this.transaction.run(async () => {
      const events = await this.outbox.claimUnpublished(BATCH_SIZE);
      for (const event of events) {
        await this.queue.enqueue(QUEUES.domainEvents, event.id, {
          ...event,
          occurredAt: event.occurredAt.toISOString(),
        });
      }
      await this.outbox.markPublished(
        events.map((e) => e.id),
        this.clock.now(),
      );
      return events.length;
    });
  }

  private schedule(delayMs: number): void {
    if (this.stopped) return;
    this.timer = setTimeout(() => void this.tick(), delayMs);
  }

  private async tick(): Promise<void> {
    let published = 0;
    try {
      published = await this.relayOnce();
    } catch (error) {
      this.logger.error('Outbox relay failed; retrying', error as Error);
    }
    // A full batch means there may be more waiting: go again right away.
    this.schedule(published === BATCH_SIZE ? 0 : IDLE_DELAY_MS);
  }
}
