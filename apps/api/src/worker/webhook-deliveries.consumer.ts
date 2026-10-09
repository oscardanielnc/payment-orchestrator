import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { DeliverWebhookUseCase } from '../modules/notifications/application/use-cases/deliver-webhook.use-case';
import { QUEUES } from '../shared/application/ports/job-queue';

/**
 * One attempt per job run. A non-2xx answer throws, so BullMQ schedules the next try with
 * exponential backoff; the last allowed attempt marks the delivery failed instead.
 */
@Processor(QUEUES.webhookDeliveries)
export class WebhookDeliveriesConsumer extends WorkerHost {
  private readonly logger = new Logger(WebhookDeliveriesConsumer.name);

  constructor(private readonly deliver: DeliverWebhookUseCase) {
    super();
  }

  async process(job: Job<{ deliveryId: string }>): Promise<void> {
    // attemptsMade counts the tries that already failed before this one.
    const isLastAllowed = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    const attempt = await this.deliver.execute({ deliveryId: job.data.deliveryId, isLastAllowed });
    if (!attempt) return;

    const ok = attempt.statusCode !== null && attempt.statusCode >= 200 && attempt.statusCode < 300;
    if (ok) return;
    if (isLastAllowed) {
      this.logger.warn(`Webhook delivery ${job.data.deliveryId} failed for good: ${attempt.error}`);
      return;
    }
    throw new Error(attempt.error ?? 'Delivery failed');
  }
}
