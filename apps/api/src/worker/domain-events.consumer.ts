import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { QUEUES } from '../shared/application/ports/job-queue';

/**
 * Receives every domain event relayed from the outbox (`charge.succeeded`...). No subscriber
 * yet: outbound merchant webhooks (feature 14) will be the first. Completing the job keeps
 * the queue empty in the meantime.
 */
@Processor(QUEUES.domainEvents)
export class DomainEventsConsumer extends WorkerHost {
  private readonly logger = new Logger(DomainEventsConsumer.name);

  process(job: Job<{ type: string; aggregateId: string }>): Promise<void> {
    this.logger.debug(`${job.data.type} for ${job.data.aggregateId}`);
    return Promise.resolve();
  }
}
