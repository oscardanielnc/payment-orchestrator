import { Module } from '@nestjs/common';
import { InboundModule } from '../modules/inbound/inbound.module';
import { NotificationsModule } from '../modules/notifications/notifications.module';
import { PaymentsModule } from '../modules/payments/payments.module';
import { DomainEventsConsumer } from './domain-events.consumer';
import { InboundEventsConsumer } from './inbound-events.consumer';
import { InboundRequeueService } from './inbound-requeue.service';
import { OutboxRelayService } from './outbox-relay.service';
import { WebhookDeliveriesConsumer } from './webhook-deliveries.consumer';
import { WebhookRequeueService } from './webhook-requeue.service';

/**
 * Queue consumers and the outbox relay: the background half of ADR 0008. Imported only by the
 * worker (and by e2e tests that need processing), never by the HTTP API.
 */
@Module({
  imports: [InboundModule, PaymentsModule, NotificationsModule],
  providers: [
    InboundEventsConsumer,
    DomainEventsConsumer,
    OutboxRelayService,
    InboundRequeueService,
    WebhookDeliveriesConsumer,
    WebhookRequeueService,
  ],
})
export class QueueConsumersModule {}
