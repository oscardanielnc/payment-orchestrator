import { Module } from '@nestjs/common';
import { InboundEventRepository } from './application/ports/inbound-ports';
import { InboundEventsService } from './application/services/inbound-events.service';
import {
  ReceiveWebhookUseCase,
  WEBHOOK_VERIFIERS,
} from './application/use-cases/receive-webhook.use-case';
import { PrismaInboundEventRepository } from './infrastructure/persistence/prisma/prisma-inbound-event.repository';
import { WebhooksController } from './presentation/http/webhooks.controller';

/**
 * Stores external events and queues them. Handlers live in the modules that own the business
 * meaning (payments...) and are wired by the worker, so this module depends on none of them.
 */
@Module({
  controllers: [WebhooksController],
  providers: [
    { provide: InboundEventRepository, useClass: PrismaInboundEventRepository },
    // Empty until a provider feature (Stripe, Mercado Pago) registers its verifier.
    { provide: WEBHOOK_VERIFIERS, useValue: [] },
    InboundEventsService,
    ReceiveWebhookUseCase,
  ],
  exports: [InboundEventsService],
})
export class InboundModule {}
