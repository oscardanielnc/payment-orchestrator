import { Processor, WorkerHost } from '@nestjs/bullmq';
import type { Job } from 'bullmq';
import { FanOutEventUseCase } from '../modules/notifications/application/use-cases/fan-out-event.use-case';
import type { PublishedEvent } from '../modules/notifications/domain/webhook-event';
import { QUEUES } from '../shared/application/ports/job-queue';

/**
 * Every domain event relayed from the outbox. Today one subscriber: outbound merchant
 * webhooks (feature 14). Re-delivery of the same event is safe: deliveries are unique per
 * (endpoint, event).
 */
@Processor(QUEUES.domainEvents)
export class DomainEventsConsumer extends WorkerHost {
  constructor(private readonly fanOut: FanOutEventUseCase) {
    super();
  }

  async process(job: Job<PublishedEvent>): Promise<void> {
    await this.fanOut.execute(job.data);
  }
}
