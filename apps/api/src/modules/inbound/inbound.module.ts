import { Module } from '@nestjs/common';
import Stripe from 'stripe';
import { AppConfig } from '../../config/app-config';
import { InboundEventRepository } from './application/ports/inbound-ports';
import { InboundEventsService } from './application/services/inbound-events.service';
import {
  ReceiveWebhookUseCase,
  WEBHOOK_VERIFIERS,
} from './application/use-cases/receive-webhook.use-case';
import { StripeWebhookVerifier } from './infrastructure/signatures/stripe-webhook.verifier';
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
    // One verifier per provider configured in this environment.
    {
      provide: WEBHOOK_VERIFIERS,
      inject: [AppConfig],
      useFactory: (config: AppConfig) => [
        ...(config.stripe
          ? [
              new StripeWebhookVerifier(
                new Stripe(config.stripe.secretKey),
                config.stripe.webhookSecret,
              ),
            ]
          : []),
      ],
    },
    InboundEventsService,
    ReceiveWebhookUseCase,
  ],
  exports: [InboundEventsService],
})
export class InboundModule {}
