import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { JobQueue, QUEUES } from '../shared/application/ports/job-queue';
import { TransactionRunner } from '../shared/application/ports/transaction-runner';
import type { InboundEventHandler } from '../modules/inbound/application/ports/inbound-ports';
import { InboundEventsService } from '../modules/inbound/application/services/inbound-events.service';
import { PAYMENT_INBOUND_HANDLERS } from '../modules/payments/payments.module';

interface InboundJob {
  inboundEventId: string;
}

/**
 * Processes stored inbound events. The handler's changes and "processed" commit together;
 * an error makes BullMQ retry with exponential backoff, and after the last attempt the job
 * is copied to the dead-letter queue and the event marked `failed`.
 */
@Processor(QUEUES.inboundEvents)
export class InboundEventsConsumer extends WorkerHost {
  private readonly logger = new Logger(InboundEventsConsumer.name);
  private readonly handlers: ReadonlyMap<string, InboundEventHandler>;

  constructor(
    private readonly inbound: InboundEventsService,
    private readonly transaction: TransactionRunner,
    private readonly queue: JobQueue,
    @Inject(PAYMENT_INBOUND_HANDLERS) handlers: InboundEventHandler[],
  ) {
    super();
    this.handlers = new Map(handlers.map((handler) => [handler.provider, handler]));
  }

  async process(job: Job<InboundJob>): Promise<void> {
    const event = await this.inbound.load(job.data.inboundEventId);
    // Should not happen (jobs are enqueued after commit); retrying covers any race left.
    if (!event) throw new Error(`Inbound event ${job.data.inboundEventId} not found`);
    if (event.status === 'processed' || event.status === 'ignored') return; // at-least-once delivery

    const handler = this.handlers.get(event.provider);
    if (!handler) {
      await this.inbound.markHandled(event.id, 'ignored');
      return;
    }
    await this.transaction.run(async () => {
      await handler.handle(event);
      await this.inbound.markHandled(event.id, 'processed');
    });
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job<InboundJob> | undefined, error: Error): Promise<void> {
    if (!job) return;
    const final = job.attemptsMade >= (job.opts.attempts ?? 1);
    await this.inbound.recordFailure(
      job.data.inboundEventId,
      error.message,
      job.attemptsMade,
      final,
    );
    if (final) {
      this.logger.error(`Inbound event ${job.data.inboundEventId} moved to the dead-letter queue`);
      await this.queue.enqueue(QUEUES.deadLetter, `inbound-${job.data.inboundEventId}`, {
        queue: QUEUES.inboundEvents,
        data: { ...job.data },
        error: error.message,
        attempts: job.attemptsMade,
      });
    }
  }
}
