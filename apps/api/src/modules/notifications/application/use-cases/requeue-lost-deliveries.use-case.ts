import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { JobQueue, QUEUES } from '../../../../shared/application/ports/job-queue';
import { WebhookDeliveryRepository } from '../ports/notification-ports';

/**
 * Safety net for deliveries stored but never queued (the process died between commit and
 * enqueue). Enqueueing one that is already queued is harmless: same jobId.
 */
@Injectable()
export class RequeueLostDeliveriesUseCase {
  constructor(
    private readonly deliveries: WebhookDeliveryRepository,
    private readonly queue: JobQueue,
    private readonly clock: Clock,
  ) {}

  async execute(olderThanMs: number): Promise<number> {
    const before = new Date(this.clock.now().getTime() - olderThanMs);
    const lost = await this.deliveries.findNeverAttempted(before, 100);
    for (const delivery of lost) {
      await this.queue.enqueue(QUEUES.webhookDeliveries, delivery.id, { deliveryId: delivery.id });
    }
    return lost.length;
  }
}
