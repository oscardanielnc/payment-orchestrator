import { Injectable } from '@nestjs/common';
import { Clock } from '../../../../shared/application/ports/clock';
import { IdGenerator } from '../../../../shared/application/ports/id-generator';
import { JobQueue, QUEUES } from '../../../../shared/application/ports/job-queue';
import { TransactionRunner } from '../../../../shared/application/ports/transaction-runner';
import { SUBSCRIBABLE_EVENTS, WebhookDelivery } from '../../domain/webhook-delivery';
import { buildWebhookPayload, type PublishedEvent } from '../../domain/webhook-event';
import { WebhookDeliveryRepository, WebhookEndpointRepository } from '../ports/notification-ports';

/**
 * A domain event left the outbox: one delivery per enabled endpoint of its organization.
 * Rows commit first, then each is enqueued (jobId = delivery id), never the other way round.
 * Running twice for the same event is harmless: (endpoint, event) is unique.
 */
@Injectable()
export class FanOutEventUseCase {
  constructor(
    private readonly endpoints: WebhookEndpointRepository,
    private readonly deliveries: WebhookDeliveryRepository,
    private readonly queue: JobQueue,
    private readonly ids: IdGenerator,
    private readonly clock: Clock,
    private readonly transaction: TransactionRunner,
  ) {}

  async execute(event: PublishedEvent): Promise<number> {
    if (!SUBSCRIBABLE_EVENTS.includes(event.type)) return 0;

    const pending = await this.transaction.run(async () => {
      const endpoints = await this.endpoints.listEnabledForOrganization(event.organizationId);
      const payload = buildWebhookPayload(event);
      const stored: WebhookDelivery[] = [];
      for (const endpoint of endpoints) {
        const delivery = WebhookDelivery.create({
          id: this.ids.uuid(),
          organizationId: event.organizationId,
          endpointId: endpoint.id,
          eventId: event.id,
          eventType: event.type,
          payload,
          now: this.clock.now(),
        });
        stored.push(await this.deliveries.insertIfAbsent(delivery));
      }
      return stored.filter((d) => d.isPending);
    });

    for (const delivery of pending) {
      await this.queue.enqueue(QUEUES.webhookDeliveries, delivery.id, { deliveryId: delivery.id });
    }
    return pending.length;
  }
}
